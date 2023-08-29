use std::collections::HashMap;
use std::collections::HashSet;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;


use tokio::fs::File;
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;

use crate::types::Chat;
use crate::types::ChatMeta;
use crate::types::Personality;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
enum FileContent {
    Chat(Chat),
    Personality(Personality),
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct FileDocument {
    version: u32,
    content: FileContent
}

#[derive(Debug, Default)]
struct Inner {
    path: PathBuf,
    chats: HashMap<String, Chat>,
    personalities: HashMap<String, Personality>,
    new_chat_ids: HashSet<String>,
    changed_personality_ids: HashSet<String>,
}

pub struct Database {
    inner: Arc<RwLock<Inner>>,
}

impl Clone for Database {
    fn clone(&self) -> Self {
        Self { 
            inner: self.inner.clone(),
        }
    }
}

async fn load_data(p: PathBuf, inner: Arc<RwLock<Inner>>) {
    let mut paths = tokio::fs::read_dir(p).await.unwrap();

    while let Some(path) = paths.next_entry().await.unwrap() {
        let path = path.path();
        log::info!("Loading {:?}", path);
        let file_name = path.file_name().unwrap().to_str().unwrap().to_string();

        let mut file = File::open(path).await.unwrap();
        let mut content = String::new();
        file.read_to_string(&mut content).await.unwrap();

        let doc: FileDocument = serde_json::from_str(&content).unwrap();

        match doc.content {
            FileContent::Chat(chat) => {
                log::info!("Loaded chat {:?}", chat.id);
                let mut inner = inner.write().await;
                inner.chats.insert(file_name, chat);
            },
            FileContent::Personality(personality) => {
                log::info!("Loaded personality {:?}", personality.id);
                let mut inner = inner.write().await;
                inner.personalities.insert(file_name, personality);
            }
        }
    }
}

impl Database {
    pub fn new<P: AsRef<Path>>(p: P) -> Self {
        let inner = Inner {
            path: p.as_ref().to_path_buf(),
            ..Default::default()
        };

        let inner = Arc::new(RwLock::new(inner));

        {
            let inner = inner.clone();
            let p = p.as_ref().to_path_buf();
            tokio::spawn(async move {
                load_data(p, inner).await;
            });
        }

        Self {
            inner: inner,
        }
    }

    pub async fn get_chat(&self, chat_id: &str) -> Option<Chat> {
        log::debug!("get_chat");
        let inner = self.inner.read().await;
        inner.chats.get(chat_id).cloned()
    }

    pub async fn save_personality(&self, personality: Personality) {
        log::debug!("save_instruction");
        let mut inner = self.inner.write().await;
        let id = personality.id.clone();
        inner.personalities.insert(id.clone(), personality);
        inner.changed_personality_ids.insert(id.clone());
    }

    pub async fn get_personality(&self, id: &str) -> Option<Personality> {
        log::debug!("get_personality");
        let inner = self.inner.read().await;
        inner.personalities.get(id).cloned()
    }

    pub async fn get_personalities(&self) -> Vec<Personality> {
        log::debug!("get_personalities");
        let inner = self.inner.read().await;
        inner.personalities.values().cloned().collect()
    }

    pub async fn del_personality(&self, id: &str) {
        log::debug!("del_personality");
        let mut inner = self.inner.write().await;
        inner.personalities.remove(id);
    }

    pub async fn save_chat(&self, chat: Chat) {
        log::debug!("save_chat");
        let mut inner = self.inner.write().await;
        let id = chat.id.clone();
        inner.chats.insert(id.clone(), chat);
        inner.new_chat_ids.insert(id);
    }

    pub async fn get_chat_metas(&self) -> Vec<ChatMeta> {
        log::debug!("get_chat_metas");
        let inner = self.inner.read().await;

        inner.chats.iter().map(|(_, chat)| {
            ChatMeta {
                id: chat.id.clone(),
                title: chat.title.clone(),
            }
        }).collect()
    }

    pub async fn save_changes(&self) {
        log::info!("saving changes to disk");
        let inner = self.inner.read().await;

        for chat_id in &inner.new_chat_ids {
            let chat = match inner.chats.get(chat_id) {
                Some(chat) => chat,
                None => {
                    log::error!("Failed to get chat: {:?}", chat_id);
                    continue;
                },
            };
            let file_name = format!("{}.json", chat_id);
            let path = inner.path.join(file_name);
            let mut file = match File::create(path).await {
                Ok(file) => file,
                Err(err) => {
                    log::error!("Failed to create file: {:?}", err);
                    continue;
                }
            };
            let doc = FileDocument {
                version: 1,
                content: FileContent::Chat(chat.clone())
            };
            let content = match serde_json::to_string(&doc) {
                Ok(content) => content,
                Err(err) => {
                    log::error!("Failed to serialize chat: {:?}", err);
                    continue;
                }
            };
            match file.write_all(content.as_bytes()).await {
                Ok(_) => {},
                Err(err) => {
                    log::error!("Failed to write chat: {:?}", err);
                    continue;
                }
            };
        }

        for personality_id in &inner.changed_personality_ids {
            let personality = match inner.personalities.get(personality_id) {
                Some(personality) => personality,
                None => {
                    log::error!("Failed to get personality: {:?}", personality_id);
                    continue;
                },
            };
            let file_name = format!("{}.json", personality_id);
            let path = inner.path.join(file_name);
            let mut file = match File::create(path).await {
                Ok(file) => file,
                Err(err) => {
                    log::error!("Failed to create file: {:?}", err);
                    continue;
                }
            };
            let doc = FileDocument {
                version: 1,
                content: FileContent::Personality(personality.clone())
            };
            let content = match serde_json::to_string(&doc) {
                Ok(content) => content,
                Err(err) => {
                    log::error!("Failed to serialize personality: {:?}", err);
                    continue;
                }
            };
            match file.write_all(content.as_bytes()).await {
                Ok(_) => {},
                Err(err) => {
                    log::error!("Failed to write personality: {:?}", err);
                    continue;
                }
            };
        }
        
    }
}