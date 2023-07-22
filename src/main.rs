use std::{convert::Infallible, net::SocketAddr, io::{self, Write}};

use anyhow::bail;
use chrono::Utc;
use clap::Parser;
use env_logger::filter;
use hyper::{service::{make_service_fn, service_fn}, Request, Body, Server, Response, Error, body};
use hyper_tungstenite::{HyperWebsocket, tungstenite::Message};
use futures_util::{stream::StreamExt, SinkExt};
use reqwest::Client;
use serde_json::{from_str, to_string};
use tokio::sync::{mpsc, broadcast};
use types::{MsgToSrv, OpenaiChatReq, OpenaiStreamResMsg, OpenaiChatMessage};

use crate::{args::{Args, Commands}, sse::{SSEvent, parse_events}, types::{Event, ChatMsg, Context, OpenaiChatRole, MsgToCli, MsgDelta}, ws_server::WsServer};

mod types;
mod args;
mod sse;
mod ws_server;

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

// impl Iterator for OpenaiChatStreamRes {
//     type Item = OpenaiStreamResMsg;

//     fn next(&mut self) -> Option<Self::Item> {
//         match self.rx.recv() {
//             Ok(item) => Some(item),
//             Err(_) => None,
//         }
//     }
// }

async fn stream_openai_chat(req: OpenaiChatReq) ->  OpenaiChatStreamRes {
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

            //println!("received chunk {}", chunk);

            let events = parse_events(&chunk);

            //println!("events: {:?}", events);

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
            
                        // println!("msg: {:?}", msg);

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

// async fn serve_ws(ws: HyperWebsocket, ctx: Context) -> anyhow::Result<()> {
//     let mut ws = ws.await?;

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

//         println!("parsed msg: {:?}", msg);

//         match msg {
//             MsgToSrv::SendMsg(msg) => {
//                 println!("{:?}", msg);

//                 let msg = ChatMsg {
//                     id: 1,
//                     message: msg.msg,
//                     user: "User".to_string(),
//                     datetime: Utc::now()
//                 };

//                 let mut chats = ctx.chats.write().await;

//                 chats[0].messages.push(msg);

//                 let mut req = OpenaiChatReq { 
//                     model: "gpt-3.5-turbo".to_string(), 
//                     messages: vec![], 
//                     stream: true
//                 };

//                 let mut word_count = 0;

//                 for msg in chats[0].messages.iter().rev().into_iter() {
//                     let len = msg.message.len();

//                     if word_count + len > 2000 {
//                         let diff = word_count + len - 2000;

//                         req.messages.push(
//                             OpenaiChatMessage {
//                                 role: OpenaiChatRole::User,
//                                 content: msg.message[diff..].to_string()
//                             }
//                         );

//                         break;
//                     }

//                     req.messages.push(
//                         OpenaiChatMessage { 
//                             role: OpenaiChatRole::User, 
//                             content: msg.message.to_string() 
//                         }
//                     );
                    
//                     word_count += msg.message.len();
//                 }

//                 tokio::spawn(async move {
//                     let mut stream = stream_openai_chat(req).await;
                    
//                     while let Some(r) = stream.next().await {
//                         // println!("OpenaiStreamResMsg: {:?}", r);
//                         let first_choise = &r.choices[0];

//                         if let Some(d) = &first_choise.delta.content {
//                             print!("{}", d);

//                             let msg = MsgToCli::MsgDelta(
//                                 MsgDelta {
//                                     msg_id: 1,
//                                     delta: d.to_string(),
//                                 }
//                             );
//                             let msg = to_string(&msg).unwrap();
//                             let msg = Message::text(msg);
//                             ws.send(msg);
//                         }
//                     }

//                     println!("");
//                 });
//             }
//         }
//     }
//     println!("closed ws conn");

//     Ok(())
// }

pub async fn handle_request(mut req: Request<Body>, ctx: Context) -> Result<Response<Body>, anyhow::Error> {
    // Use the connection pool here

    log::info!("handle_request {}", req.uri());

    if hyper_tungstenite::is_upgrade_request(&req) {
        log::info!("there is upgrade request");

        let (response, ws) = hyper_tungstenite::upgrade(&mut req, None)?;

        log::info!("websocket upgraded");

        // let id = ctx.next_client_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        match req.uri().path() {
            "/ws" => {
                println!("new ws request");

                tokio::spawn(async move {
                    let ws = ws.await.unwrap();
                    WsServer::new(ws, ctx.clone()).serve().await;
                });
            }
            &_ | _ => {
                bail!("not allowed url")
            }
        };

        return Ok(response);
    }

    todo!()

    // match req.uri().path() {
    //     "/index.js" => {
    //         let response = Response::new(Body::from(index_js_bytes));
    //         Ok(response)
    //     },
    //     _ => {
    //         let response = serve_index();
    //         Ok(response)
    //     }
    // }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    match args.command {
        Commands::Ask(args) => {
            let message = OpenaiChatMessage {
                content: args.question,
                ..Default::default()
            };

            let req = OpenaiChatReq {
                stream: true,
                model: "gpt-3.5-turbo".to_string(),
                messages: vec![message],
                ..Default::default()
            };

            let mut stream = stream_openai_chat(req).await;

            let stdout = io::stdout();
            let mut handle = stdout.lock();
            

            while let Some(msg) = stream.next().await {
                let first_choice = &msg.choices[0];
                if let Some(content) = &first_choice.delta.content {
                    // print!("{}", content);

                    handle.write_all(content.as_bytes())?;
                    handle.flush();
                }
            }
        },
        Commands::Server => {
            let ctx = Context::new();

            let make_scv = make_service_fn(move |_| {
                let ctx = ctx.clone();
                async move {
                    Ok::<_, Infallible>(service_fn(move |req| {
                        let ctx = ctx.clone();
                        handle_request(req, ctx)
                    }))
                }
            });
        
            println!("listen port: 5566");
        
            let addr = SocketAddr::from(([127, 0, 0, 1], 5566));
            Server::bind(&addr).serve(make_scv).await?;       
        }
    }

    Ok(())
}
