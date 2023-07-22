
#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct Msg {
    pub room: u32,
    pub msg: String
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct MsgDelta {
    msg_id: u32,
    delta: String
}

#[derive(serde::Deserialize, Debug)]
pub enum MsgToSrv {
    SendMsg(Msg)
}

#[derive(serde::Serialize, Debug)]
pub enum MsgToCli {
    MsgDelta(MsgDelta)
}

#[derive(Debug)]
pub enum Event {
    MsgDelta
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