use anyhow::anyhow;
use jsonwebtoken::Algorithm;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::EncodingKey;
use jsonwebtoken::Header;
use jsonwebtoken::Validation;
use jsonwebtoken::decode;
use jsonwebtoken::encode;
use jsonwebtoken::errors::ErrorKind;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    sub: String,
    company: String,
    exp: usize,
    user: String
}

pub async fn encode_hs512_token(key: &[u8], username: &str) -> anyhow::Result<String> {
    let my_claims: Claims = Claims { 
        sub: "b@b.com".to_owned(), 
        company: "ACME".to_owned(), 
        exp: 10000000000,
        user: username.to_string()
    };

    let header = Header { 
        kid: Some("signing_key".to_owned()), 
        alg: Algorithm::HS512, 
        ..Default::default() 
    };

    let token = encode(&header, &my_claims, &EncodingKey::from_secret(key))?;

    Ok(token)
}

pub enum JwtDecodeResult {
    InvalidToken,
    InvalidSignature,
    ExpiredSignature,
    GeneralError(anyhow::Error),
    Claims(Claims)
}

pub async fn decode_hs512_token(key: &[u8], token: &str) -> JwtDecodeResult {
    let decode_res = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(key),
        &Validation::new(Algorithm::HS512),
    );
    match decode_res {
        Ok(t) => {
            JwtDecodeResult::Claims(t.claims)
        },
        Err(e) => {
            match &e.kind() {
                ErrorKind::InvalidToken => JwtDecodeResult::InvalidToken,
                ErrorKind::InvalidSignature => JwtDecodeResult::InvalidSignature,
                ErrorKind::ExpiredSignature => JwtDecodeResult::ExpiredSignature,
                _ => {
                    JwtDecodeResult::GeneralError(anyhow!(e))
                } 
            }
        }
    }
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