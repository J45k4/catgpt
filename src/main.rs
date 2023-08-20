
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
use hyper::HeaderMap;
use hyper::Request;
use hyper::Response;
use hyper::Server;
use hyper::http::HeaderValue;
use hyper::service::make_service_fn;
use hyper::service::service_fn;
use jsonwebtoken::Algorithm;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::EncodingKey;
use jsonwebtoken::Header;
use jsonwebtoken::Validation;
use jsonwebtoken::decode;
use jsonwebtoken::encode;
use jsonwebtoken::errors::ErrorKind;
use reqwest::Client;
use serde::Deserialize;
use serde::Serialize;
use tokio::sync::broadcast;
use types::Context;
use types::OpenaiChatMessage;
use types::OpenaiChatReq;

use crate::args::ConfigCommands;
use crate::args::ConfigKeys;
use crate::config::Config;
use crate::database::Database;

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

macro_rules! serve_static_file {
    ($path:expr) => {{
        let body = match std::option_env!("STATIC_ASSETS") {
            Some(_) => {
                log::debug!("Using included asset");
                Body::from(include_str!($path))
            },
            None => {
                log::debug!("Using file asset");
                let path = Path::new("./src").join($path);
                Body::from(tokio::fs::read_to_string(path).await?)
            }
        };

        if $path.ends_with(".js") {
            Response::builder()
                .header("Content-Type", "application/javascript")
                .body(body)?
        } else if $path.ends_with(".css") {
            Response::builder()
                .header("Content-Type", "text/css")
                .body(body)?
        } else if $path.ends_with(".html") {
            Response::builder()
                .header("Content-Type", "text/html")
                .body(body)?
        } else {
            Response::new(body)
        }
    }};
}

struct User {

}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    company: String,
    exp: usize,
}

async fn encode_token() {
    let my_claims = Claims { 
        sub: "b@b.com".to_owned(), 
        company: "ACME".to_owned(), 
        exp: 10000000000 
    };
    let key = b"secret";

    let header = Header { 
        kid: Some("signing_key".to_owned()), 
        alg: Algorithm::HS512, 
        ..Default::default() 
    };

    let token = match encode(&header, &my_claims, &EncodingKey::from_secret(key)) {
        Ok(t) => t,
        Err(_) => panic!(), // in practice you would return the error
    };
    println!("{:?}", token);
}

async fn decode_token(token: &str) {


    let key = b"secret";
    let token_data = match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(key),
        &Validation::new(Algorithm::HS512),
    ) {
        Ok(c) => c,
        Err(err) => match *err.kind() {
            ErrorKind::InvalidToken => panic!(), // Example on how to handle a specific error
            _ => panic!(),
        },
    };
}


async fn validate_token(headers: &HeaderMap<HeaderValue>) -> Option<User> {
    let authorization = headers.get("authorization");

    match authorization {
        Some(v) => {
            let v = match v.to_str() {
                Ok(v) => v,
                Err(_) => return None,
            };

            let v = v.trim();

            if v.starts_with("Bearer ") {
                let token = v.trim_start_matches("Bearer ");

                
            }

            Some(User {})
        },
        None => None,
    }
}

pub async fn handle_request(mut req: Request<Body>, ctx: Context) -> Result<Response<Body>, anyhow::Error> {
    log::info!("handle_request {}", req.uri());
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

            Ok(serve_static_file!("../web/dist/app.js"))
        },
        "/index.css" => {
            log::debug!("using index.css");
            Ok(serve_static_file!("../web/index.css"))
        },
        "/login" => {
            log::debug!("using login.html");
            Ok(serve_static_file!("../web/login.html"))
        },
        _ => {
            log::debug!("using index.html");
            Ok(serve_static_file!("../web/index.html"))
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    env_logger::Builder::new()
        .filter_level(log::LevelFilter::Debug)
        .init();

    let args = Args::parse();

    let mut config = Config::provide();
    
    let client = Client::new();

    let (ch, _) = broadcast::channel::<Event>(100);
    let db = Database::new();

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
