use clap::Parser;
use clap::Subcommand;
use clap::ValueEnum;

#[derive(Debug, Parser)]
#[clap(name = "aki")]
pub struct Args {
    #[clap(subcommand)]
    pub command: Commands,
    #[clap(short, long, default_value = "0")]
    pub log: usize
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    #[clap(name = "ask")]
    Ask(AskArgs),
    #[clap(name = "server")]
    Server,
    Config(ConfigArgs)
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
    Get(GetArgs)
}

#[derive(Debug, Clone, Parser, ValueEnum)]
pub enum ConfigKeys {
    OpenaiApikey
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