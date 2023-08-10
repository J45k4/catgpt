
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
use reqwest::Client;
use tokio::fs;
use tokio::sync::broadcast;
use types::Context;
use types::OpenaiChatMessage;
use types::OpenaiChatReq;

use crate::args::ConfigCommands;
use crate::args::ConfigKeys;
use crate::config::Config;
use crate::database::Database;
use crate::openai::Openai;
use crate::openai::OpenaiBuilder;
use crate::types::Event;
use crate::ws_server::WsServer;


mod types;
mod args;
mod sse;
mod ws_server;
mod random;
mod openai;
mod config;
mod database;

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
                log::debug!("new ws request");

                tokio::spawn(async move {
                    let ws = ws.await.unwrap();
                    WsServer::new(ws, ctx.clone()).serve().await;
                });
            }
            _ => {
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
        "/index.css" => {
            log::debug!("using index.css");

            let index_css = fs::read_to_string("./web/index.css").await?;
            Ok(Response::new(Body::from(index_css)))
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

    let mut config = Config::provide();
    
    let client = Client::new();

    let (ch, _) = broadcast::channel::<Event>(100);
    let db = Database::new();

    let openai = OpenaiBuilder {
        ch: ch.clone(),
        client: client,
        db: db.clone(),
        token: config.openai_apikey.clone(),
    }.build();

    let ctx = Context {
        ch: ch,
        db: db,
        openai: openai.clone()
    };

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

            let mut stream = openai.stream_openai_chat(req).await;

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
            let make_scv = make_service_fn(move |_| {
                let ctx = ctx.clone();
                async move {
                    Ok::<_, Infallible>(service_fn(move |req| {
                        let ctx = ctx.clone();
                        async move {
                            match handle_request(req, ctx).await {
                                Ok(res) => {
                                    Ok::<_, Infallible>(res)
                                },
                                Err(e) => {
                                    log::error!("request error: {}", e);
                                    Ok::<_, Infallible>(Response::new(Body::from("error")))
                                }
                            }
                        }
                    }))
                }
            });
        
            println!("listen port: 5566");
        
            let addr = SocketAddr::from(([127, 0, 0, 1], 5566));
            Server::bind(&addr).serve(make_scv).await?;       
        },
        Commands::Config(args) => {
            match args.command {
                ConfigCommands::Set(args) => {
                    match args.key {
                        ConfigKeys::OpenaiApikey => {
                            config.openai_apikey = Some(args.value);
                        }
                    }

                    config.save_default();
                },
                ConfigCommands::Get(args) => {
                    match args.key {
                        ConfigKeys::OpenaiApikey => {
                            if let Some(apikey) = &config.openai_apikey {
                                println!("{}", apikey);
                            } else {
                                println!("not set");
                            }
                        }
                    }
                },
            }
        }
    }

    Ok(())
}
