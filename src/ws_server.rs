use anyhow::bail;
use chrono::Utc;
use futures_util::SinkExt;
use futures_util::StreamExt;
use hyper_tungstenite::WebSocketStream;
use hyper_tungstenite::tungstenite::Message;
use serde_json::from_str;
use serde_json::to_string;
use uuid::Uuid;

use crate::auth::JwtDecodeResult;
use crate::auth::decode_hs512_token;
use crate::auth::encode_hs512_token;
use crate::config::Config;
use crate::config::JWTKeyType;
use crate::openai::CreateOpenaiReq;
use crate::random::create_random_resp;
use crate::types::Chat;
use crate::types::Context;
use crate::types::ChatMsg;
use crate::types::Event;
use crate::types::MODEL_GPT_3_5;
use crate::types::MODEL_GPT_4;
use crate::types::MODEL_RANDOM;
use crate::types::MsgToCli;
use crate::types::MsgToSrv;
use crate::types::Personalities;
use crate::types::Personality;


pub struct WsServer {
    ws: WebSocketStream<hyper::upgrade::Upgraded>,
    ctx: Context,
    authenicated: bool,
    user: Option<String>,
    config: Config
}

impl WsServer {
    pub fn new(ws: WebSocketStream<hyper::upgrade::Upgraded>, ctx: Context) -> WsServer {
        let config = Config::provide();

        WsServer { 
            ws,
            ctx,
            authenicated: false,
            user: None,
            config
        }
    }

    async fn handle_ws_msg(&mut self, msg: String) -> anyhow::Result<()> {
        let msg: MsgToSrv = match from_str(&msg) {
            Ok(m) => m,
            Err(err) => {
                log::error!("{} parse err: {:?}", msg, err);
                bail!("parse err");
            },
        };
        if let Some(true) = self.config.login_required {
            if !self.authenicated {
                match &msg {
                    MsgToSrv::Authenticate { token } => {
                        match self.config.jwt_key_type {
                            Some(JWTKeyType::HS512) | None => {
                                let key = match &self.config.jwt_hs512_key {
                                    Some(key) => key,
                                    None => {
                                        log::error!("no jwt key");
                                        bail!("no jwt key");
                                    }
                                };

                                match decode_hs512_token(key.as_bytes(), token).await {
                                    JwtDecodeResult::InvalidToken => {
                                        log::error!("invalid token");
                                        let msg = MsgToCli::AuthTokenInvalid;
                                        self.send_msg(msg).await;
                                    },  
                                    JwtDecodeResult::InvalidSignature => {
                                        log::error!("invalid signature");
                                        let msg = MsgToCli::AuthTokenInvalid;
                                        self.send_msg(msg).await;
                                    },
                                    JwtDecodeResult::ExpiredSignature => {
                                        log::error!("expired signature");
                                        let msg = MsgToCli::AuthTokenInvalid;
                                        self.send_msg(msg).await;
                                    },
                                    JwtDecodeResult::GeneralError(err) => bail!(err),
                                    JwtDecodeResult::Claims(c) => {
                                        log::info!("auth success {:?}", c);
                                        self.user = Some(c.user);
                                        let msg = MsgToCli::Authenticated { token: token.clone() };
                                        self.authenicated = true;
                                        self.send_msg(msg).await;
                                    },
                                }
                            },
                            _ => todo!()
                        }
                    },
                    MsgToSrv::Login { username, password } => {
                        let user = match &self.config.users {
                            Some(users) => {
                                match users.iter().find(|u| u.username == *username) {
                                    Some(user) => user,
                                    None => {
                                        log::error!("user not found");
                                        bail!("user not found");
                                    }
                                }
                            },
                            None => {
                                log::error!("no users");
                                bail!("no users");
                            }
                        };                    

                        if user.password != *password {
                            log::error!("password not match");
                            let msg = MsgToCli::AuthError;
                            self.send_msg(msg).await;
                            bail!("password not match");
                        }

                        match self.config.jwt_key_type {
                            Some(JWTKeyType::HS512) | None => {
                                let key = match &self.config.jwt_hs512_key {
                                    Some(key) => key,
                                    None => {
                                        log::error!("no jwt key");
                                        bail!("no jwt key");
                                    }
                                };

                                let token = encode_hs512_token(key.as_bytes(), &user.username).await?;
                                let msg = MsgToCli::Authenticated { token: token.clone() };
                                self.authenicated = true;
                                self.send_msg(msg).await;
                            },
                            _ => todo!()
                        }
                    },
                    _ => {
                        log::error!("not authenticated");
                        let msg = MsgToCli::AuthError;
                        self.send_msg(msg).await;
                    }
                }
            }
        }
    
        match msg {
            MsgToSrv::SendMsg(msg) => {
                log::debug!("{:?}", msg);

                let chat = match msg.chat_id {
                    Some(chat_id) => {
                        self.ctx.db.get_chat(&chat_id).await
                    }
                    None => None
                };

                let mut chat = match chat {
                    Some(chat) => chat,
                    None => {
                        let new_chat = Chat::new();
                        self.send_msg(MsgToCli::ChatCreated { chat: new_chat.clone() }).await;
                        self.ctx.ch.send(Event::NewChat { chat: new_chat.clone() }).unwrap();
                        new_chat
                    },
                };

                let user_name = match &self.user {
                    Some(user) => user.clone(),
                    None => "User".to_string()
                };

                let chat_id = chat.id.clone();

                let chatmsg = ChatMsg {
                    id: Uuid::new_v4().to_string(),
                    chat_id: chat_id.clone(),
                    message: msg.txt,
                    bot: false,
                    user: user_name.clone(),
                    user_id: user_name,
                    datetime: Utc::now()
                };

                chat.messages.push(chatmsg.clone());

                self.ctx.db.save_chat(chat).await;
                self.ctx.db.save_changes().await;

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
                };
            }
            MsgToSrv::GetChats { } => {
                let metas = self.ctx.db.get_chat_metas().await;
                let msg = MsgToCli::ChatMetas { metas };
                self.send_msg(msg).await;
            }
            MsgToSrv::CreateChat(args) => {
                log::debug!("{:?}", args);

                let chat = Chat {
                    id: args.chat_id.clone(),
                    messages: vec![],
                    ..Default::default()
                };

                self.ctx.db.save_chat(chat.clone()).await;



                self.send_msg(MsgToCli::ChatCreated { chat }).await;
            }
            MsgToSrv::GetChat { chat_id } => {
                log::debug!("{:?}", chat_id);

                let chat = self.ctx.db.get_chat(&chat_id).await;

                match chat {
                    Some(chat) => {
                        let msg = MsgToCli::Chat(chat.clone());
                        self.send_msg(msg).await;
                    },
                    None => {
                        log::error!("chat {} not found", chat_id);
                    }
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

                self.ctx.db.save_changes().await;

                let msg = MsgToCli::PersonalitySaved {
                    personality: personality.clone()
                };
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
                self.ctx.db.save_changes().await;
                self.send_msg(MsgToCli::PersonalityDeleted { id }).await;
            },
            MsgToSrv::DelMsg { chat_id, msg_id } => {
                log::debug!("del msg {} from chat {}", msg_id, chat_id);

                match self.ctx.db.get_chat(&chat_id).await {
                    Some(mut chat) => {
                        chat.messages.retain(|m| m.id != msg_id);
                        self.ctx.db.save_chat(chat).await;
                        self.send_msg(MsgToCli::MsgDeleted { chat_id, msg_id }).await;
                        self.ctx.db.save_changes().await;
                    },
                    None => {
                        log::error!("chat {} not found", chat_id);
                    }
                }
            },
            MsgToSrv::Authenticate { token } => {
                log::debug!("authenticate {}", token);
                let msg = MsgToCli::Authenticated { token };
                self.send_msg(msg).await;
            },
            _ => {}
        }

        Ok(())
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
            },
            Event::TitleDelta { chat_id, delta: title } => {
                let msg = MsgToCli::TitleDelta { chat_id, delta: title };
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
                        Message::Text(text) => match self.handle_ws_msg(text).await {
                            Ok(_) => {},
                            Err(err) => {
                                log::error!("ws msg error: {:?}", err);
                                break;
                            }
                        },
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