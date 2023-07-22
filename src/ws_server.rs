use chrono::Utc;
use futures_util::SinkExt;
use futures_util::StreamExt;
use hyper_tungstenite::HyperWebsocket;
use hyper_tungstenite::WebSocketStream;
use hyper_tungstenite::tungstenite::Message;
use serde_json::from_str;
use serde_json::to_string;

use crate::stream_openai_chat;
use crate::types::Context;
use crate::types::ChatMsg;
use crate::types::Event;
use crate::types::MsgDelta;
use crate::types::MsgToCli;
use crate::types::MsgToSrv;
use crate::types::OpenaiChatMessage;
use crate::types::OpenaiChatReq;
use crate::types::OpenaiChatRole;


pub struct WsServer {
    ws: WebSocketStream<hyper::upgrade::Upgraded>,
    ctx: Context
}

impl WsServer {
    pub fn new(ws: WebSocketStream<hyper::upgrade::Upgraded>, ctx: Context) -> WsServer {
        WsServer { 
            ws: ws,
            ctx: ctx 
        }
    }

    async fn handle_ws_msg(&mut self, msg: String) {
        let msg: MsgToSrv = match from_str(&msg) {
            Ok(m) => m,
            Err(err) => {
                println!("parse err: {:?}", err);
                return;
            },
        };

        println!("parsed msg: {:?}", msg);
    
        match msg {
            MsgToSrv::SendMsg(msg) => {
                println!("{:?}", msg);

                let msg = ChatMsg {
                    id: 1,
                    message: msg.msg,
                    user: "User".to_string(),
                    datetime: Utc::now()
                };

                let mut chats = self.ctx.chats.write().await;

                chats[0].messages.push(msg);

                let mut req = OpenaiChatReq { 
                    model: "gpt-3.5-turbo".to_string(), 
                    messages: vec![], 
                    stream: true
                };

                let mut word_count = 0;

                for msg in chats[0].messages.iter().into_iter() {
                    let len = msg.message.len();

                    if word_count + len > 2000 {
                        let diff = word_count + len - 2000;

                        req.messages.push(
                            OpenaiChatMessage {
                                role: OpenaiChatRole::User,
                                content: msg.message[diff..].to_string()
                            }
                        );

                        break;
                    }

                    req.messages.push(
                        OpenaiChatMessage { 
                            role: OpenaiChatRole::User, 
                            content: msg.message.to_string() 
                        }
                    );
                    
                    word_count += msg.message.len();
                }

                let ctx = self.ctx.clone();
                tokio::spawn(async move {
                    let mut stream = stream_openai_chat(req).await;
                    
                    while let Some(r) = stream.next().await {
                    //     // println!("OpenaiStreamResMsg: {:?}", r);
                        let first_choise = &r.choices[0];

                        if let Some(d) = &first_choise.delta.content {
                            let event = Event::MsgDelta(
                                MsgDelta {
                                    msg_id: 1,
                                    delta: d.to_string()
                                }
                            );

                            ctx.ch.send(event);

                            // let msg = MsgToCli::MsgDelta(
                            //     MsgDelta {
                            //         msg_id: 1,
                            //         delta: d.to_string(),
                            //     }
                            // );
                            // let msg = to_string(&msg).unwrap();
                            // let msg = Message::text(msg);
                            // ws.send(msg);
                        }
                    }
                });
            }
        }
    }

    async fn handle_event(&mut self, event: Event) {
        match event {
            Event::MsgDelta(delta) => {
                let msg = MsgToCli::MsgDelta(
                    MsgDelta {
                        msg_id: 1,
                        delta: delta.delta.to_string(),
                    }
                );
                let msg = to_string(&msg).unwrap();
                let msg = Message::text(msg);
                self.ws.send(msg).await;
            },
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

    //     loop {
    //         let msg = {
    //             let msg = match ws.next().await {
    //                 Some(m) => m,
    //                 None => break,
    //             };
    
    //             let msg = match msg {
    //                 Ok(m) => m,
    //                 Err(err) => {
    //                     println!("error: {:?}", err);
    //                     break;
    //                 },
    //             };
    
    //             let msg = match msg {
    //                 Message::Text(text) => text,
    //                 Message::Binary(_) => continue,
    //                 Message::Ping(_) => {
    //                     println!("ping");
    //                     continue;
    //                 },
    //                 Message::Pong(_) => continue,
    //                 Message::Close(_) => {
    //                     println!("close");
    //                     continue;
    //                 },
    //                 Message::Frame(_) => continue,
    //             };
    
    //             let msg: MsgToSrv = match from_str(&msg) {
    //                 Ok(m) => m,
    //                 Err(err) => {
    //                     println!("parse err: {:?}", err);
    //                     break;
    //                 },
    //             };
    
    //             msg
    //         };
    //     }
    //     println!("closed ws conn");
    // }
}

async fn handle_ws_msg(msg: String) {

}