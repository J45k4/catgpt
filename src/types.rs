

use chrono::DateTime;
use chrono::Utc;

use tokio::sync::broadcast;

use crate::database::Database;
use crate::openai::Openai;


#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SendMsg {
    pub chat_id: Option<String>,
    pub model: String,
    pub instructions: Option<String>,
    pub txt: String
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MsgDelta {
    pub chat_id: String,
    pub msg_id: String,
    pub delta: String,
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
    SendMsg(SendMsg),
    GetChats(GetChats),
    CreateChat(CreateChat),
    #[serde(rename_all = "camelCase")]
    GetChat {
        chat_id: String
    },
    #[serde(rename_all = "camelCase")]
    SavePersonality {
        id: Option<String>,
        txt: String
    },
    GetPersonalities,
    DelPersonality {
        id: String
    },
    #[serde(rename_all = "camelCase")]
    DelMsg {
        chat_id: String,
        msg_id: String
    },
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ChatIds {
    pub ids: Vec<String>
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Personality {
    pub id: String,
    pub txt: String
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Personalities {
    pub personalities: Vec<Personality>
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct NewPersonality {
    pub personality: Personality
}

// #[derive(Debug, serde::Serialize, serde::Deserialize)]
// pub struct PersonalityDeleted {
//     pub id: String
// }

#[derive(serde::Serialize, Debug)]
#[serde(tag = "type")]
pub enum MsgToCli {
    MsgDelta(MsgDelta),
    ChatIds(ChatIds),
    Chat(Chat),
    Personalities(Personalities),
    NewPersonality(NewPersonality),
    PersonalityDeleted {
        id: String
    },
    ChatCreated {
        chat: Chat
    },
    NewMsg {
        msg: ChatMsg
    },
    NewChat {
        chat: Chat
    },
    #[serde(rename_all = "camelCase")]
    MsgDeleted {
        chat_id: String,
        msg_id: String
    },
}

#[derive(Debug, Clone)]
pub enum Event {
    MsgDelta(MsgDelta),
    NewMsg {
        msg: ChatMsg
    },
    NewChat {
        chat: Chat
    },
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

#[derive(Default, Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMsg {
    pub id: String,
    pub chat_id: String,
    pub message: String,
    pub user: String,
    pub datetime: DateTime<Utc>,
    pub bot: bool
}

#[derive(Default, Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Chat {
    pub id: String,
    pub messages: Vec<ChatMsg>
}

// pub struct Conversations {
//     conversations: Vec<Conversation>
// }

pub struct Context {
    pub db: Database,
    pub ch: broadcast::Sender<Event>,
    pub openai: Openai
}

impl Clone for Context {
    fn clone(&self) -> Self {
        Self { 
            openai: self.openai.clone(),
            db: self.db.clone(),
            ch: self.ch.clone()
        }
    }
}

impl Context {
    pub fn new(openai: Openai) -> Self {
        let (ch, _) = broadcast::channel::<Event>(100);

        Self { 
            openai,
            ch,
            db: Database::new()
        }
    }
}

pub const MODEL_RANDOM: &str = "random";
pub const MODEL_GPT_3_5: &str = "gpt3.5";
pub const MODEL_GPT_4: &str = "gpt4";