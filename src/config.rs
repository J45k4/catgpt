use std::path::Path;

use serde::Deserialize;
use serde::Serialize;


#[derive(Debug, Deserialize, Serialize)]
pub struct Config {
    pub openai_apikey: String,
}

impl Config {
    pub fn load<P: AsRef<Path>>(path: P) -> Config {
        let path = path.as_ref();
        let config_str = std::fs::read_to_string(path).unwrap();
        let config: Config = serde_json::from_str(&config_str).unwrap();
        config
    }

    pub fn save<P: AsRef<Path>>(&self, path: P) {
        let path = path.as_ref();
        let config_str = serde_json::to_string_pretty(self).unwrap();
        std::fs::write(path, config_str).unwrap();
    }
}