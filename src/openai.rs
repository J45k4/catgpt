use std::vec;
use anyhow::bail;
use chrono::Duration;
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
use crate::tokenizer::GPT2Tokenizer;
use crate::types::Chat;
use crate::types::ChatMeta;
use crate::types::ChatMsg;

use crate::types::Event;
use crate::types::MODEL_GPT_3_5;
use crate::types::MODEL_GPT_4;
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
            rx
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

fn parse_model(model: &str) -> String {
    let r = match model {
        MODEL_GPT_3_5 => "gpt-3.5-turbo",
        MODEL_GPT_4 => "gpt-4",
        _ => todo!("model not supported")
    };
    r.to_string()
}

impl Openai {
    pub async fn stream_openai_chat(&self, req: OpenaiChatReq) ->  OpenaiChatStreamRes {
        let apikey = match self.apikey.clone() {
            Some(apikey) => apikey,
            None => return OpenaiChatStreamRes::new(mpsc::channel(0).1)
        };
    
        let body_str = to_string(&req).unwrap();
    
        log::info!("OpenAI request: {}", body_str);
    
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
                    Err(_error) => break,
                };

                log::debug!("raw chunk: {}", chunk);
    
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
    
        OpenaiChatStreamRes{ rx }
    }

    pub async fn chat_completion(&self, model: String, messages: Vec<OpenaiChatMessage>) -> anyhow::Result<String> {
        let apikey = match self.apikey.clone() {
            Some(apikey) => apikey,
            None => bail!("apikey not set")
        };

        let mut model = parse_model(&model);

        let req = OpenaiChatReq { 
            model: model.to_string(), 
            messages, 
            stream: false,
            ..Default::default()
        };
        let body_str = to_string(&req).unwrap();

        let response = self.client.post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", apikey))
            .header("Content-Type", "application/json")
            .body(body_str)
            .send()
            .await.unwrap();

        Ok(response.text().await?)
    }

    pub async fn create_openai_resp(&self, req: CreateOpenaiReq) {
        let model = "gpt-4-1106-preview".to_string();
        let token_limit = 100_000;

        let tokenizer = GPT2Tokenizer::new().await.unwrap();
    
        let mut openai_chat_req = OpenaiChatReq { 
            model: model.to_string(), 
            messages: vec![], 
            stream: true,
            ..Default::default()
        };
    
        let mut total_token_count = 0;

        if let Some(instructions) = &req.ins {
            let token_count = tokenizer.count_tokens(&instructions).unwrap();
            if token_count > token_limit {
                log::error!("instructions too long");
            } else {
                total_token_count += token_count;
            }
        }

        let mut chat = self.db.get_chat(&req.chat_id).await.unwrap();
        let cutofftime = Utc::now() - Duration::minutes(10);
    
        let req = {
            for msg in chat.messages.iter().rev() {
                let token_count = tokenizer.count_tokens(&msg.message).unwrap();
    
                let role = if msg.bot { OpenaiChatRole::Assistant } 
                else { OpenaiChatRole::User };

                // if token_count > 3500 {
                //     model = "gpt-3.5-turbo-16k".to_string();
                //     token_limit = 15_000;
                // }
        
                if total_token_count + token_count > token_limit {
                    break;
                }

                if openai_chat_req.messages.len() > 1 {
                    if msg.datetime < cutofftime {
                        log::info!("skipping old message {:?}", msg);
                        break;
                    }
                }

                if openai_chat_req.messages.len() > 2 && total_token_count > 3500 {
                    log::info!("skipping long message {:?}", msg);
                    break;
                }
        
                openai_chat_req.messages.push(
                    OpenaiChatMessage { 
                        role, 
                        content: msg.message.to_string() 
                    }
                );
                
                total_token_count += msg.message.len();
            }
    
            req
        };

        openai_chat_req.messages.push(
            OpenaiChatMessage { 
                role: OpenaiChatRole::System, 
                content: "Your name is catty and you are helpfull cute personal assistant made by Cow.".to_string()
            }
        );

        openai_chat_req.messages.reverse();

        log::info!("total_token_count: {}", total_token_count);
    
        let msg_id = uuid::Uuid::new_v4().to_string();
        let mut stream = self.stream_openai_chat(openai_chat_req.clone()).await;

        let mut new_msg = ChatMsg {
            id: msg_id.clone(),
            chat_id: req.chat_id.clone(),
            datetime: Utc::now(),
            message: "".to_string(),
            token_count: 0,
            bot: true,
            user: "Catty".to_string(),
            user_id: model.to_string()
        };
        
        self.ch.send(Event::NewMsg { msg: new_msg.clone() }).unwrap();
        let mut log_deltas = Vec::new();

        while let Some(r) = stream.next().await {
            log::debug!("{:?}", r);

            let first_choise = &r.choices[0];

            if let Some(finish_reason) = &first_choise.finish_reason { 
                log::info!("finish_reason: {}", finish_reason);
            }
    
            if let Some(d) = &first_choise.delta.content {
                log_deltas.push(d.to_string());

                if log_deltas.len() > 10 {
                    log::info!("{}", log_deltas.join(""));
                    log_deltas.clear();
                }

                new_msg.message.push_str(d);
                let event = Event::MsgDelta(
                    MsgDelta {
                        chat_id: req.chat_id.clone(),
                        msg_id: msg_id.clone(),
                        delta: d.to_string()
                    }
                );
    
                self.ch.send(event).unwrap();
            }
        }

        if log_deltas.len() > 0 {
            log::info!("{}", log_deltas.join(""));
        }

        new_msg.token_count = tokenizer.count_tokens(&new_msg.message).unwrap();
        log::info!("output token count: {}", new_msg.token_count);
        chat.messages.push(new_msg.clone());
        self.ch.send(Event::GenerationDone { 
            chat_id: req.chat_id.clone(),
            msg_id: msg_id.clone(),
            msg: new_msg.message.clone(),
            token_count: new_msg.token_count
        }).unwrap();

        if chat.title.is_none() {
            self.gen_title_for_chat(&mut chat).await;
        }

        self.db.save_chat(chat).await;
        self.db.save_changes().await;
    }

    async fn gen_title_for_chat(&self, chat: &mut Chat) {
        let mut openai_chat_req = OpenaiChatReq { 
            model: "gpt-3.5-turbo".to_string(), 
            messages: vec![], 
            stream: true,
            ..Default::default()
        };

        let mut word_count = 0;

        for msg in chat.messages.iter().rev() {
            let words = msg.message.split_whitespace().collect::<Vec<_>>();
            let count = words.len();

            let role = if msg.bot { OpenaiChatRole::Assistant } 
            else { OpenaiChatRole::User };
    
            if word_count + count > 1000 {
                break;
            }
    
            openai_chat_req.messages.push(
                OpenaiChatMessage { 
                    role, 
                    content: msg.message.to_string() 
                }
            );
            
            word_count += msg.message.len();
        }

        openai_chat_req.messages.reverse();

        openai_chat_req.messages.push(
            OpenaiChatMessage { 
                role: OpenaiChatRole::User, 
                content: "summarise this conversation with very short sentence. Be very brief it is important!!".into()
            }
        );

        let mut new_title = String::new();

        let mut stream = self.stream_openai_chat(openai_chat_req.clone()).await;

        self.ch.send(Event::ChatMeta(
            ChatMeta {
                id: chat.id.clone(),
                title: None,
                last_msg_datetime: None
            }
        )).unwrap_or_default();

        while let Some(r) = stream.next().await {
            log::debug!("{:?}", r);

            let first_choise = &r.choices[0];
    
            if let Some(d) = &first_choise.delta.content {
                new_title += d;

                let event = Event::TitleDelta { 
                    chat_id: chat.id.clone(), 
                    delta: d.to_string()
                };
    
                self.ch.send(event).unwrap();
            }
        }

        log::info!("new chat title: {}", new_title);
        chat.title = Some(new_title);
    }

    pub async fn gen_title(&self, chat_id: String) {
        log::info!("gen new title for chat {}", chat_id);

        let mut chat = match self.db.get_chat(&chat_id).await {
            Some(chat) => chat,
            None => {
                log::error!("chat not found");
                return
            }
        };

        self.gen_title_for_chat(&mut chat).await;     
        self.db.save_chat(chat).await;
        self.db.save_changes().await;
    }
}