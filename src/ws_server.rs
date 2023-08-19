use chrono::Utc;
use futures_util::SinkExt;
use futures_util::StreamExt;
use hyper_tungstenite::WebSocketStream;
use hyper_tungstenite::tungstenite::Message;
use serde_json::from_str;
use serde_json::to_string;
use uuid::Uuid;

use crate::openai::CreateOpenaiReq;
use crate::random::create_random_resp;
use crate::types::Chat;
use crate::types::ChatIds;
use crate::types::Context;
use crate::types::ChatMsg;
use crate::types::Event;
use crate::types::MODEL_GPT_3_5;
use crate::types::MODEL_GPT_4;
use crate::types::MODEL_RANDOM;
use crate::types::MsgToCli;
use crate::types::MsgToSrv;
use crate::types::NewPersonality;
use crate::types::Personalities;
use crate::types::Personality;


pub struct WsServer {
    ws: WebSocketStream<hyper::upgrade::Upgraded>,
    ctx: Context
}

impl WsServer {
    pub fn new(ws: WebSocketStream<hyper::upgrade::Upgraded>, ctx: Context) -> WsServer {
        WsServer { 
            ws,
            ctx 
        }
    }

    async fn handle_ws_msg(&mut self, msg: String) {
        let msg: MsgToSrv = match from_str(&msg) {
            Ok(m) => m,
            Err(err) => {
                log::error!("{} parse err: {:?}", msg, err);
                return;
            },
        };
    
        match msg {
            MsgToSrv::SendMsg(msg) => {
                log::debug!("{:?}", msg);

                let chat_id = match msg.chat_id {
                    Some(chat_id) => self.ctx.db.get_chat(&chat_id).await.map(|c| c.id),
                    None => None
                };

                let chat_id = match chat_id {
                    Some(chat_id) => chat_id,
                    None => {
                        let id = Uuid::new_v4().to_string();

                        log::info!("chat_id not found, create new chat {}", id);

                        let new_chat = Chat {
                            id: id.clone(),
                            messages: vec![]
                        };
                        self.ctx.db.add_chat(new_chat.clone()).await;
                        self.send_msg(MsgToCli::ChatCreated { chat: new_chat.clone() }).await;
                        self.ctx.ch.send(Event::NewChat { chat: new_chat }).unwrap();
                        id
                    }
                };

                let chatmsg = ChatMsg {
                    id: Uuid::new_v4().to_string(),
                    chat_id: chat_id.clone(),
                    message: msg.txt,
                    bot: false,
                    user: "User".to_string(),
                    datetime: Utc::now()
                };

                self.ctx.db.save_msg(chatmsg.clone()).await;

                match msg.model.as_str() {
                    MODEL_RANDOM => {
                        tokio::spawn(create_random_resp(self.ctx.clone(), chat_id));
                    },
                    MODEL_GPT_3_5 | MODEL_GPT_4 => {
                        let model = msg.model.clone();
                        let openai = self.ctx.openai.clone();
                        tokio::spawn(async move {
                            let req = CreateOpenaiReq {
                                model,
                                ins: msg.instructions,
                                chat_id,
                            };
                            openai.create_openai_resp(req).await;
                        });
                    }
                    _ => {}
                }
            }
            MsgToSrv::GetChats(args) => {
                log::debug!("{:?}", args);

                let chat_ids = self.ctx.db.get_chat_ids().await;
                let msg = ChatIds {
                    ids: chat_ids
                };
                let msg = MsgToCli::ChatIds(msg);
                self.send_msg(msg).await;
            }
            MsgToSrv::CreateChat(args) => {
                log::debug!("{:?}", args);

                let chat = Chat {
                    id: args.chat_id.clone(),
                    messages: vec![],
                };

                self.ctx.db.add_chat(chat.clone()).await;

                self.send_msg(MsgToCli::ChatCreated { chat }).await;
            }
            MsgToSrv::GetChat { chat_id } => {
                log::debug!("{:?}", chat_id);

                let chat = self.ctx.db.get_chat(&chat_id).await;

                if let Some(chat) = chat {
                    let msg = MsgToCli::Chat(chat.clone());
                    let msg = to_string(&msg).unwrap();
                    let msg = Message::text(msg);
                    self.ws.send(msg).await.unwrap();
                }
            },
            MsgToSrv::SavePersonality { id, txt } => {
                log::debug!("{:?}", txt);

                let personality = match id {
                    Some(id) => {
                        let personality = self.ctx.db.get_personality(&id).await;

                        match personality {
                            Some(mut personality) => {
                                personality.txt = txt;
                                self.ctx.db.save_personality(personality.clone()).await;
                                personality
                            },
                            None => {
                                let new_personality = Personality {
                                    id,
                                    txt
                                };

                                self.ctx.db.save_personality(new_personality.clone()).await;
                                new_personality
                            }
                        }
                    },
                    None => {
                        let new_personality = Personality {
                            id: Uuid::new_v4().to_string(),
                            txt
                        };

                        self.ctx.db.save_personality(new_personality.clone()).await;
                        new_personality
                    }
                };

                let msg = MsgToCli::NewPersonality(NewPersonality {
                    personality
                });
                self.send_msg(msg).await;
            },
            MsgToSrv::GetPersonalities => {
                log::debug!("get personalities");

                let personalities = self.ctx.db.get_personalities().await;
                let msg = Personalities {
                    personalities
                };
                let msg = MsgToCli::Personalities(msg);
                self.send_msg(msg).await;
            },
            MsgToSrv::DelPersonality { id } => {
                log::debug!("del personality {}", id);
                self.ctx.db.del_personality(&id).await;
                self.send_msg(MsgToCli::PersonalityDeleted { id }).await;
            },
            MsgToSrv::DelMsg { chat_id, msg_id } => {
                log::debug!("del msg {} from chat {}", msg_id, chat_id);
                self.ctx.db.del_msg(&chat_id, &msg_id).await;
                self.send_msg(MsgToCli::MsgDeleted { chat_id, msg_id }).await;
            }
        }
    }

    async fn send_msg(&mut self, msg: MsgToCli) {
        let msg = to_string(&msg).unwrap();
        log::debug!("send to client: {}", msg);
        let msg = Message::text(msg);
        self.ws.send(msg).await.unwrap();
    }

    async fn handle_event(&mut self, event: Event) {
        match event {
            Event::MsgDelta(delta) => {
                let msg = MsgToCli::MsgDelta(delta);
                self.send_msg(msg).await;
            },
            Event::NewMsg { msg } => {
                let msg = MsgToCli::NewMsg { msg };
                self.send_msg(msg).await;
            },
            Event::NewChat { chat } => {
                let msg = MsgToCli::NewChat { chat };
                self.send_msg(msg).await;
            }
        }
    }

    pub async fn serve(mut self) {
        let mut rx = self.ctx.ch.subscribe();

        loop {
            tokio::select! {
                msg = self.ws.next() => {
                    let msg = match msg {
                        Some(Ok(m)) => m,
                        Some(Err(err)) => {
                            println!("error: {:?}", err);
                            break;
                        },
                        None => break
                    };

                    match msg {
                        Message::Text(text) =>  self.handle_ws_msg(text).await,
                        Message::Binary(_) => continue,
                        Message::Ping(_) => {
                            println!("ping");
                            continue;
                        },
                        Message::Pong(_) => continue,
                        Message::Close(_) => {
                            println!("close");
                            continue;
                        },
                        Message::Frame(_) => continue,
                    };
                }
                event = rx.recv() => {
                    let event = match event {
                        Ok(e) => e,
                        Err(err) => {
                            println!("error: {:?}", err);
                            break;
                        }
                    };

                    self.handle_event(event).await;
                }
            }
        }
    }
}