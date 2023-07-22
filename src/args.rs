use clap::{Parser, Subcommand};

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
    Server
}

#[derive(Debug, Parser)]
pub struct AskArgs {
    pub question: String
}
