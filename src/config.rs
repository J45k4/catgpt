use std::path::Path;

use dirs::home_dir;
use serde::Deserialize;
use serde::Serialize;


#[derive(Debug, Deserialize, Serialize, Default)]
pub struct Config {
    pub openai_apikey: Option<String>,
    pub login_required: Option<bool>
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