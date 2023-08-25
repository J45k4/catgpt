use anyhow::Ok;
use jsonwebtoken::Algorithm;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::EncodingKey;
use jsonwebtoken::Header;
use jsonwebtoken::Validation;
use jsonwebtoken::decode;
use jsonwebtoken::encode;
use serde::Deserialize;
use serde::Serialize;

use crate::types::User;

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    company: String,
    exp: usize,
    user: String
}

pub async fn encode_token(username: &str) -> anyhow::Result<String> {
    let my_claims = Claims { 
        sub: "b@b.com".to_owned(), 
        company: "ACME".to_owned(), 
        exp: 10000000000,
        user: username.to_string()
    };
    let key = b"secret";

    let header = Header { 
        kid: Some("signing_key".to_owned()), 
        alg: Algorithm::HS512, 
        ..Default::default() 
    };

    let token = encode(&header, &my_claims, &EncodingKey::from_secret(key))?;
    println!("{:?}", token);

    Ok(token)
}

pub async fn decode_token(token: &str) -> anyhow::Result<User> {
    let key = b"secret";
    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(key),
        &Validation::new(Algorithm::HS512),
    )?;

    println!("{:?}", token_data.claims);

    Ok(User {})
}


// pub async fn validate_token(headers: &HeaderMap<HeaderValue>) -> Option<User> {
//     let authorization = headers.get("authorization");

//     match authorization {
//         Some(v) => {
//             let v = match v.to_str() {
//                 Ok(v) => v,
//                 Err(_) => return None,
//             };

//             let v = v.trim();

//             if v.starts_with("Bearer ") {
//                 let token = v.trim_start_matches("Bearer ");

                
//             }

//             Some(User {})
//         },
//         None => None,
//     }
// }