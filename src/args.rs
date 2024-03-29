use clap::Parser;
use clap::Subcommand;
use clap::ValueEnum;

#[derive(Debug, Parser)]
#[clap(name = "aki")]
pub struct Args {
    #[clap(subcommand)]
    pub command: Commands,
    #[clap(short, long, default_value = "1")]
    pub log: usize
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    #[clap(name = "ask")]
    Ask(AskArgs),
    #[clap(name = "server")]
    Server,
    Config(ConfigArgs),
    AddUser {
        username: String,
        password: String
    },
    CountTokens {
        input: String
    },
    Transcribe {
        #[clap(long)]
        model: String,
        input: String,
        output: String
    }
}

#[derive(Debug, Parser)]
pub struct AskArgs {
    pub question: String
}

#[derive(Debug, Parser)]
pub struct ConfigArgs {
    #[clap(subcommand)]
    pub command: ConfigCommands   
}

#[derive(Debug, Clone, Subcommand)]
pub enum ConfigCommands {
    Set(SetArgs),
    Get(GetArgs),
}

#[derive(Debug, Clone, Parser, ValueEnum)]
pub enum ConfigKeys {
    OpenaiApikey,
    LoginRequired,
    HS512Key,
    ProjectFolder,
}

#[derive(Debug, Clone, Parser)]
pub struct SetArgs {
    pub key: ConfigKeys,
    pub value: String
}

#[derive(Debug, Clone, Parser)]
pub struct GetArgs {
    pub key: ConfigKeys
}