
use std::convert::Infallible;
use std::io;
use std::io::Write;
use std::net::SocketAddr;
use std::path::Path;

use anyhow::bail;
use args::Args;
use args::Commands;
use clap::Parser;
use hyper::Body;
use hyper::Request;
use hyper::Response;
use hyper::Server;
use hyper::StatusCode;
use hyper::service::make_service_fn;
use hyper::service::service_fn;
use reqwest::Client;
use tokio::sync::broadcast;
use types::Context;
use types::OpenaiChatMessage;
use types::OpenaiChatReq;

use crate::args::ConfigCommands;
use crate::args::ConfigKeys;
use crate::config::Config;
use crate::config::get_version;
use crate::database::Database;

use crate::openai::OpenaiBuilder;
use crate::tokenizer::GPT2Tokenizer;
use crate::types::Event;
use crate::types::User;
use crate::ws_server::WsServer;


mod types;
mod args;
mod sse;
mod ws_server;
mod random;
mod openai;
mod config;
mod database;
mod tokenizer;
#[cfg(feature = "whisper")]
mod wisper;
mod auth;

pub async fn handle_request(mut req: Request<Body>, ctx: Context) -> Result<Response<Body>, anyhow::Error> {
    log::info!("{} {}", req.method(), req.uri());
    log::debug!("agent: {:?}", req.headers().get("user-agent"));

    if hyper_tungstenite::is_upgrade_request(&req) {
        log::info!("there is upgrade request");
        let (response, ws) = hyper_tungstenite::upgrade(&mut req, None)?;
        log::info!("websocket upgraded");

        match req.uri().path() {
            "/ws" => {
                log::debug!("new ws request");

                tokio::spawn(async move {
                    let ws = ws.await.unwrap();
                    WsServer::new(ws, ctx.clone()).await.serve().await;
                });
            }
            _ => {
                bail!("not allowed url")
            }
        };

        return Ok(response);
    }

    let path = req.uri().path();

    let static_path = "./web/dist";
    log::info!("static_path: {:?}", static_path);
    let file_path = format!("{}{}", static_path, path);
    let file_path = Path::new(&file_path);
    log::info!("file_path: {:?}", file_path);
    if file_path.exists() && file_path.is_file() {
        let content = tokio::fs::read(&file_path).await?;
        let mime_type = mime_guess::from_path(&file_path).first_or_octet_stream();
    
        let res = Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", mime_type.as_ref())
            .body(Body::from(content))
            .unwrap();
        return Ok(res);
    }

    match path.trim() {
        _ => {
            log::debug!("using index.html");
            let index_path = format!("{}/index.html", static_path);
            let content = tokio::fs::read(&index_path).await?;
            let res = Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "text/html")
                .body(Body::from(content))
                .unwrap();
            Ok(res)
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {


    log::info!("version {}", get_version());

    let args = Args::parse();
    
    if args.log > 0 {
        let level = match args.log {
            1 => log::LevelFilter::Info,
            2 => log::LevelFilter::Debug,
            _ => log::LevelFilter::Trace
        };

        env_logger::Builder::new()
            .filter_level(level)
            .init();
    }

    let mut config = Config::provide();
    
    let client = Client::new();

    let (ch, _) = broadcast::channel::<Event>(100);
    let db = Database::new(config.db_path());

    let openai = OpenaiBuilder {
        ch: ch.clone(),
        client,
        db: db.clone(),
        token: config.openai_apikey.clone(),
    }.build();

    let ctx = Context {
        ch,
        db,
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
                    handle.flush().unwrap();
                }
            }
        },
        Commands::AddUser { username, password } => {
            let user = User {
                username,
                password
            };

            config.users = match config.users {
                Some(mut users) => {
                    users.push(user);
                    Some(users)
                },
                None => {
                    Some(vec![user])
                }
            };

            config.save_default();
        },
        Commands::Server => {
            GPT2Tokenizer::prepare_vocab().await?;

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
        
            log::info!("listen port: 5566");
        
            let addr = SocketAddr::from(([0, 0, 0, 0], 5566));
            Server::bind(&addr).serve(make_scv).await?;       
        },
        Commands::Config(args) => {
            match args.command {
                ConfigCommands::Set(args) => {
                    match args.key {
                        ConfigKeys::OpenaiApikey => {
                            config.openai_apikey = Some(args.value);
                        },
                        ConfigKeys::LoginRequired => {
                            let value = match args.value.as_str() {
                                "true" => true,
                                "false" => false,
                                _ => {
                                    bail!("invalid value")
                                }
                            };

                            config.login_required = Some(value);
                        },
                        ConfigKeys::HS512Key => {
                            config.jwt_hs512_key = Some(args.value);
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
                        },
                        ConfigKeys::LoginRequired => {
                            if let Some(login_required) = &config.login_required {
                                println!("{}", login_required);
                            } else {
                                println!("not set");
                            }
                        },
                        ConfigKeys::HS512Key => {
                            if let Some(key) = &config.jwt_hs512_key {
                                println!("{}", key);
                            } else {
                                println!("not set");
                            }
                        }
                    }
                },
            }
        },
        Commands::CountTokens { input } => {
            let input = match Path::new(&input).exists() {
                true => tokio::fs::read_to_string(input).await?,
                false => input
            };

            let tokenizer = GPT2Tokenizer::new().await?;
            let count = tokenizer.count_tokens(&input)?;
            println!("token count: {}", count);
        },
        #[cfg(feature = "whisper")]
        Commands::Transcribe { model, input, output } => {
            transcribe_file(model, input, output);  
        }
        _ => {}
    }

    Ok(())
}
