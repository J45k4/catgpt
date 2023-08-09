use std::sync::Arc;

use tokio::sync::RwLock;

use crate::types::Chat;
use crate::types::ChatMsg;

pub struct Database {
    pub chats: Arc<RwLock<Vec<Chat>>>
}

impl Clone for Database {
    fn clone(&self) -> Self {
        Self { 
            chats: self.chats.clone()
        }
    }
}

impl Database {
    pub fn new() -> Self {
        Self { 
            chats: Arc::new(RwLock::new(vec![]))
        }
    }

    pub async fn add_msg(&self, id: &str, msg: ChatMsg) {
        log::debug!("add_msg {}", id);
        let mut chats = self.chats.write().await;
        let chat = chats.iter_mut().find(|c| c.id == id);
        match chat {
            Some(chat) => {
                chat.messages.push(msg);
            },
            None => {
                log::error!("chat not found {}", id);
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
}