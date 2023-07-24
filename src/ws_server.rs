use chrono::Utc;
use futures_util::SinkExt;
use futures_util::StreamExt;
use hyper_tungstenite::HyperWebsocket;
use hyper_tungstenite::WebSocketStream;
use hyper_tungstenite::tungstenite::Message;
use serde_json::from_str;
use serde_json::to_string;

use crate::openai::create_openai_resp;
use crate::random::create_random_resp;
use crate::stream_openai_chat;
use crate::types::Context;
use crate::types::ChatMsg;
use crate::types::Event;
use crate::types::MODEL_GPT_3_5;
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

                let chatmsg = ChatMsg {
                    id: 1,
                    message: msg.txt,
                    user: "User".to_string(),
                    datetime: Utc::now()
                };

                let mut chats = self.ctx.chats.write().await;

                chats[0].messages.push(chatmsg);

                if msg.model == "random" {
                    tokio::spawn(create_random_resp(self.ctx.clone()));
                }

                if msg.model == MODEL_GPT_3_5 {
                    tokio::spawn(create_openai_resp(self.ctx.clone()));
                }
            }
        }
    }

    async fn handle_event(&mut self, event: Event) {
        match event {
            Event::MsgDelta(delta) => {
                let msg = MsgToCli::MsgDelta(delta);
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