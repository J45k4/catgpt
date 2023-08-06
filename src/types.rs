use std::sync::Arc;

use chrono::DateTime;
use chrono::Utc;
use tokio::sync::RwLock;
use tokio::sync::broadcast;


#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Msg {
    pub chat_id: String,
    pub msg_cli_id: String, 
    pub model: String,
    pub instructions: Option<String>,
    pub txt: String
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MsgDelta {
    pub msg_id: String,
    pub author: String,
    pub delta: String
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct GetChats {

}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateChat {
    pub chat_id: String,
}

#[derive(serde::Deserialize, Debug)]
#[serde(tag = "type")]
pub enum MsgToSrv {
    SendMsg(Msg),
    GetChats(GetChats),
    CreateChat(CreateChat)
}

pub struct ChatMetadata {

}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ChatIds {
    pub ids: Vec<String>
}

#[derive(serde::Serialize, Debug)]
#[serde(tag = "type")]
pub enum MsgToCli {
    MsgDelta(MsgDelta),
    ChatIds(ChatIds)
}

#[derive(Debug, Clone)]
pub enum Event {
    MsgDelta(MsgDelta)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub enum OpenaiChatRole {
    #[serde(rename="system")]
    System,
    #[serde(rename="user")]
    User,
    #[serde(rename="assistant")]
    Assistant,
    #[serde(rename="function")]
    Function
}

impl Default for OpenaiChatRole {
    fn default() -> Self {
        Self::User
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct OpenaiChatFunc {
    pub name: String,
    pub description: String,
    pub parameters: String 
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct OpenaiChatMessage {
    pub role: OpenaiChatRole,
    pub content: String,
    // pub name: Option<String>,
    // pub function_call: Option<String>
}

#[derive(serde::Serialize, serde::Deserialize)]
pub enum CallFunction {
    #[serde(rename="none")]
    None,
    #[serde(rename="auto")]
    Auto
}

impl Default for CallFunction {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Default, serde::Serialize, serde::Deserialize)]
pub struct OpenaiChatReq {
    pub model: String,
    pub messages: Vec<OpenaiChatMessage>,
    // pub functions: Option<Vec<OpenaiChatFunc>>,
    // pub function_call: Option<CallFunction>,
    // pub temperature: Option<u32>,
    // pub top_k: Option<u32>,
    // pub n: Option<u32>,
    pub stream: bool,
    // pub stop: Vec<String>,
    // pub max_tokens: Option<u32>
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Delta {
    pub role: Option<String>,
    pub content: Option<String>
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenaiStreamChoice {
    // pub finish_reason: Option<String>,
    pub index: u32,
    pub delta: Delta
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenaiStreamResMsg {
    pub choices: Vec<OpenaiStreamChoice>
}

#[derive(Default, Debug, Clone)]
pub struct ChatMsg {
    pub id: String,
    pub message: String,
    pub user: String,
    pub datetime: DateTime<Utc>,
    pub bot: bool
}

#[derive(Default, Debug, Clone)]
pub struct Chat {
    pub id: String,
    pub messages: Vec<ChatMsg>
}

// pub struct Conversations {
//     conversations: Vec<Conversation>
// }

pub struct Context {
    pub chats: Arc<RwLock<Vec<Chat>>>,
    pub ch: broadcast::Sender<Event>
}

impl Clone for Context {
    fn clone(&self) -> Self {
        Self { 
            chats: self.chats.clone(),
            ch: self.ch.clone()
        }
    }
}

impl Context {
    pub fn new() -> Self {
        let (ch, _) = broadcast::channel::<Event>(100);

        Self { 
            chats: Arc::new(RwLock::new(vec![])),
            ch: ch
        }
    }
}

pub const MODEL_RANDOM: &str = "random";
pub const MODEL_GPT_3_5: &str = "gpt3.5";
pub const MODEL_GPT_4: &str = "gpt4";