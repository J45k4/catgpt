use std::collections::HashMap;
use std::sync::Arc;

use log::error;
use tokio::sync::RwLock;

use crate::types::Chat;
use crate::types::ChatMsg;
use crate::types::Personality;

pub struct Database {
    chats: Arc<RwLock<Vec<Chat>>>,
    personalities: Arc<RwLock<HashMap<String, Personality>>>,
}

impl Clone for Database {
    fn clone(&self) -> Self {
        Self { 
            chats: self.chats.clone(),
            personalities: self.personalities.clone()
        }
    }
}

impl Database {
    pub fn new() -> Self {
        Self { 
            chats: Arc::new(RwLock::new(vec![])),
            personalities: Arc::new(RwLock::new(HashMap::new()))
        }
    }

    pub async fn save_msg(&self, msg: ChatMsg) {
        log::debug!("add_msg to chat {}", msg.chat_id);
        let mut chats = self.chats.write().await;
        let chat = chats.iter_mut().find(|c| c.id == msg.chat_id);
        match chat {
            Some(chat) => {
                chat.messages.push(msg);
            },
            None => {
                log::error!("chat {} not found", msg.chat_id);
            }
        }
    }

    pub async fn add_chat(&self, chat: Chat) {
        log::debug!("add_chat");
        let mut chats = self.chats.write().await;
        chats.push(chat);
    }

    pub async fn get_chat(&self, chat_id: &str) -> Option<Chat> {
        log::debug!("get_chat");
        let chats = self.chats.read().await;
        let chat = chats.iter().find(|c| c.id == chat_id);
        chat.cloned()
    }

    pub async fn get_chat_ids(&self) -> Vec<String> {
        log::debug!("get_chat_ids");
        let chats = self.chats.read().await;
        chats.iter().map(|c| c.id.clone()).collect()
    }

    pub async fn save_personality(&self, personality: Personality) {
        log::debug!("save_instruction");
        let mut personalities = self.personalities.write().await;
        personalities.insert(personality.id.clone(), personality);
    }

    pub async fn get_personality(&self, id: &str) -> Option<Personality> {
        log::debug!("get_personality");
        let personalities = self.personalities.read().await;
        personalities.get(id).cloned()
    }

    pub async fn get_personalities(&self) -> Vec<Personality> {
        log::debug!("get_personalities");
        let personalities = self.personalities.read().await;
        personalities.values().cloned().collect()
    }

    pub async fn del_personality(&self, id: &str) {
        log::debug!("del_personality");
        let mut personalities = self.personalities.write().await;
        personalities.remove(id);
    }

    pub async fn del_msg(&self, chat_id: &str, msg_id: &str) {
        log::debug!("del_msg");
        let mut chats = self.chats.write().await;
        let chat = chats.iter_mut().find(|c| c.id == chat_id);
        match chat {
            Some(chat) => {
                let msg = chat.messages.iter().position(|m| m.id == msg_id);
                match msg {
                    Some(msg) => {
                        chat.messages.remove(msg);
                    },
                    None => {
                        log::error!("msg {} not found", msg_id);
                    }
                }
            },
            None => {
                log::error!("chat {} not found", chat_id);
            }
        }
    }
}