use chrono::Utc;
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::from_str;
use serde_json::to_string;
use tokio::sync::mpsc;

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

pub async fn stream_openai_chat(req: OpenaiChatReq) ->  OpenaiChatStreamRes {
    let apikey = match std::env::var("OPENAI_APIKEY") {
        Ok(r) => r,
        Err(_) => panic!("OPENAI_APIKEY not set"),
    };

    let body_str = to_string(&req).unwrap();

    println!("body_str: {}", body_str);

    let (tx, rx) = mpsc::channel(30);
    
    let client = Client::new();
    let response = client.post("https://api.openai.com/v1/chat/completions")
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

pub async fn create_openai_resp(ctx: Context, model: String, instructions: Option<String>) {
    let model = match model {
        MODEL_GPT_3_5 => "gpt-3.5-turbo",
        MODEL_GPT_4 => "gpt-4",
        _ => todo!("model not supported")
    };

    let mut req = OpenaiChatReq { 
        model: model.to_string(), 
        messages: vec![], 
        stream: true
    };

    let mut word_count = 0;

    if let Some(instructions) = instructions {
        req.messages.push(
            OpenaiChatMessage { 
                role: OpenaiChatRole::System, 
                content: instructions
            }
        );
    }

    let req = {
        let chats = ctx.chats.read().await;

        for msg in chats[0].messages.iter().into_iter() {
            let len = msg.message.len();

            let role = if msg.bot { OpenaiChatRole::Assistant } 
            else { OpenaiChatRole::User };
    
            if word_count + len > 2000 {
                let diff = word_count + len - 2000;
    
                req.messages.push(
                    OpenaiChatMessage {
                        role: role,
                        content: msg.message[diff..].to_string()
                    }
                );
    
                break;
            }
    
            req.messages.push(
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

    let mut stream = stream_openai_chat(req).await;

    let mut text = String::new();
    
    while let Some(r) = stream.next().await {
        let first_choise = &r.choices[0];

        println!("first_choise: {:?}", first_choise);

        if let Some(d) = &first_choise.delta.content {
            text += d;
            let event = Event::MsgDelta(
                MsgDelta {
                    msg_id: msg_id.clone(),
                    author: "ChatGPT".to_string(),
                    delta: d.to_string()
                }
            );

            ctx.ch.send(event);
        }
    }

    let mut chats = ctx.chats.write().await;

    chats[0].messages.push(
        ChatMsg {
            id: msg_id,
            datetime: Utc::now(),
            message: text,
            bot: true,
            user: "ChatGPT".to_string()
        }
    )
}