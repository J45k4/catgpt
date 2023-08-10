use chrono::Utc;
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::from_str;
use serde_json::to_string;
use tokio::sync::broadcast;
use tokio::sync::mpsc;

use crate::database::Database;
use crate::sse::SSEvent;
use crate::sse::parse_events;
use crate::types::ChatMsg;
use crate::types::Context;
use crate::types::Event;
use crate::types::MsgDelta;
use crate::types::OpenaiChatMessage;
use crate::types::OpenaiChatReq;
use crate::types::OpenaiChatRole;
use crate::types::OpenaiStreamResMsg;

pub struct OpenaiChatStreamRes {
    rx: mpsc::Receiver<OpenaiStreamResMsg>
}

impl OpenaiChatStreamRes {
    pub fn new(rx: mpsc::Receiver<OpenaiStreamResMsg>) -> OpenaiChatStreamRes {
        Self {
            rx: rx
        }
    }

    pub async fn next(&mut self) -> Option<OpenaiStreamResMsg> {
        self.rx.recv().await
    }

    pub fn stop(&self) {

    }
}



pub struct CreateOpenaiReq {
    pub model: String,
    pub chat_id: String,
    pub ins: Option<String>,
}

pub struct OpenaiBuilder {
    pub token: Option<String>,
    pub client: Client,
    pub ch: broadcast::Sender<Event>,
    pub db: Database
}

impl OpenaiBuilder {
    pub fn build(self) -> Openai {
        Openai {
            apikey: self.token,
            client: self.client,
            ch: self.ch,
            db: self.db
        }
    }
}

pub struct Openai {
    apikey: Option<String>,
    client: Client,
    ch: broadcast::Sender<Event>,
    db: Database
}

impl Clone for Openai {
    fn clone(&self) -> Self {
        Self {
            apikey: self.apikey.clone(),
            client: self.client.clone(),
            ch: self.ch.clone(),
            db: self.db.clone()
        }
    }
}

impl Openai {
    pub async fn stream_openai_chat(&self, req: OpenaiChatReq) ->  OpenaiChatStreamRes {
        let apikey = match self.apikey.clone() {
            Some(apikey) => apikey,
            None => return OpenaiChatStreamRes::new(mpsc::channel(0).1)
        };
    
        let body_str = to_string(&req).unwrap();
    
        log::debug!("body_str: {}", body_str);
    
        let (tx, rx) = mpsc::channel(30);
        
        let response = self.client.post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", apikey))
            .header("Content-Type", "application/json")
            .body(body_str)
            .send().await.unwrap();
    
        let mut body = response.bytes_stream();
    
        tokio::spawn(async move {
            while let Some(chunk) = body.next().await {
                let chunk = match chunk {
                    Ok(r) => r,
                    Err(_) => break
                };
                let chunk = match String::from_utf8(chunk.to_vec()) {
                    Ok(utf8_string) => utf8_string,
                    Err(error) => break,
                };
    
                let events = parse_events(&chunk);
    
                for event in events {
                    match event {
                        SSEvent::Data(data) => {
                            let msg: OpenaiStreamResMsg = match from_str(&data) {
                                Ok(m) => m,
                                Err(err) => {
                                    println!("err {:?}", err);
                                    break
                                },
                            };
    
                            match tx.send(msg).await {
                                Ok(_) => {},
                                Err(_) => break,
                            }
                        },
                        SSEvent::Done => break
                    }
                }
            }
        });
    
        OpenaiChatStreamRes{ rx: rx }
    }

    pub async fn create_openai_resp(&self, req: CreateOpenaiReq) {
        let model = match &req.model {
            MODEL_GPT_3_5 => "gpt-3.5-turbo",
            MODEL_GPT_4 => "gpt-4",
            _ => todo!("model not supported")
        };
    
        let mut openai_chat_req = OpenaiChatReq { 
            model: model.to_string(), 
            messages: vec![], 
            stream: true
        };
    
        let mut word_count = 0;
    
        if let Some(instructions) = &req.ins {
            openai_chat_req.messages.push(
                OpenaiChatMessage { 
                    role: OpenaiChatRole::System, 
                    content: instructions.to_string()
                }
            );
        }
    
        let req = {
            let chat = self.db.get_chat(&req.chat_id).await.unwrap();
    
            for msg in chat.messages.iter().into_iter() {
                let len = msg.message.len();
    
                let role = if msg.bot { OpenaiChatRole::Assistant } 
                else { OpenaiChatRole::User };
        
                if word_count + len > 2000 {
                    let diff = word_count + len - 2000;
        
                    openai_chat_req.messages.push(
                        OpenaiChatMessage {
                            role: role,
                            content: msg.message[diff..].to_string()
                        }
                    );
        
                    break;
                }
        
                openai_chat_req.messages.push(
                    OpenaiChatMessage { 
                        role: role, 
                        content: msg.message.to_string() 
                    }
                );
                
                word_count += msg.message.len();
            }
    
            req
        };
    
        let msg_id = uuid::Uuid::new_v4().to_string();
    
        let mut stream = self.stream_openai_chat(openai_chat_req).await;
    
        let mut text = String::new();
        
        while let Some(r) = stream.next().await {
            log::debug!("{:?}", r);

            let first_choise = &r.choices[0];
    
            if let Some(d) = &first_choise.delta.content {
                text += d;
                let event = Event::MsgDelta(
                    MsgDelta {
                        msg_id: msg_id.clone(),
                        author: "ChatGPT".to_string(),
                        delta: d.to_string()
                    }
                );
    
                self.ch.send(event);
            }
        }

        self.db.add_msg(&req.chat_id, ChatMsg {
            id: msg_id,
            datetime: Utc::now(),
            message: text,
            bot: true,
            user: "ChatGPT".to_string()
        }).await;
    }
}