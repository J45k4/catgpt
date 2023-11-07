use std::path::Path;

use dirs::home_dir;
use serde::Deserialize;
use serde::Serialize;

use crate::types::User;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub enum JWTKeyType {
    HS512,
    RSA
}

impl Default for JWTKeyType {
    fn default() -> Self {
        JWTKeyType::HS512
    }
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct Config {
    pub openai_apikey: Option<String>,
    pub login_required: Option<bool>,
    pub users: Option<Vec<User>>,
    pub jwt_key_type: Option<JWTKeyType>,
    pub jwt_hs512_key: Option<String>,
    db_path: Option<String>,
    pub project_folder: Option<String>,
}

impl Config {
    pub fn load<P: AsRef<Path>>(path: P) -> Config {
        let path = path.as_ref();
        let config_str = std::fs::read_to_string(path).unwrap();
        let config: Config = toml::from_str(&config_str).unwrap();
        config
    }

    pub fn save<P: AsRef<Path>>(&self, path: P) {
        let path = path.as_ref();
        let config_str = toml::to_string(&self).unwrap();
        std::fs::write(path, config_str).unwrap();
    }

    pub fn save_default(&self) {
        let aki_dir = home_dir().unwrap().join(".aki");

        if !aki_dir.exists() {
            std::fs::create_dir_all(&aki_dir).unwrap();
        }

        let config_path = aki_dir.join("config.toml");

        self.save(config_path);
    }

    pub fn db_path(&self) -> String {
        if let Some(db_path) = &self.db_path {
            return db_path.to_string();
        }

        let db_path = home_dir().unwrap().join(".aki").join("db");

        if !db_path.exists() {
            std::fs::create_dir_all(&db_path).unwrap();
        }

        db_path.to_str().unwrap().to_string()
    }

    pub fn provide() -> Config {
        let config_path = home_dir().unwrap().join(".aki/config.toml");

        match config_path.exists() {
            true => {
                Config::load(config_path)
            },
            false => {
                Config::default()
            }
        }
    }
}

pub fn get_version() -> &'static str {
    match option_env!("VERSION") {
        Some(ver) => {
            ver
        },
        None => {
            "CUTE_PUPPY"
        }
    }
}