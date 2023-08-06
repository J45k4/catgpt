
use std::convert::Infallible;
use std::io;
use std::io::Write;
use std::net::SocketAddr;

use anyhow::bail;
use args::Args;
use args::Commands;
use clap::Parser;
use hyper::Body;
use hyper::Request;
use hyper::Response;
use hyper::Server;
use hyper::service::make_service_fn;
use hyper::service::service_fn;
use openai::stream_openai_chat;
use tokio::fs;
use types::Context;
use types::OpenaiChatMessage;
use types::OpenaiChatReq;

use crate::ws_server::WsServer;


mod types;
mod args;
mod sse;
mod ws_server;
mod random;
mod openai;
mod config;

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

    let path = req.uri().path();

    match path.trim() {
        "/app.js" => {
            log::debug!("using app.js");

            let app_js = fs::read_to_string("./web/dist/app.js").await?;
            Ok(Response::new(Body::from(app_js)))
        },
        _ => {
            log::debug!("using index.html");

            let index_html = fs::read_to_string("./web/index.html").await?;
            Ok(Response::new(Body::from(index_html)))
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let builder = env_logger::Builder::new()
        .filter_level(log::LevelFilter::Debug)
        .init();

    let args = Args::parse();

    log::debug!("hello there!");

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
