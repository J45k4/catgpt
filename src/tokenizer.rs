use anyhow::bail;
use tokenizers::models::bpe::BPE;
use tokenizers::normalizers::bert::BertNormalizer;
use tokenizers::pre_tokenizers::byte_level::ByteLevel;
use tokenizers::processors::byte_level::ByteLevel as ByteLevelProcessor;
use tokenizers::tokenizer::{Tokenizer, Result};
use tokio::fs;

pub struct GPT2Tokenizer {
    tokenizer: Tokenizer,
}

impl GPT2Tokenizer {
    pub async fn prepare_vocab() -> anyhow::Result<()> {
        let workdir = "workdir";
        let vocab_path = format!("{}/vocab.json", workdir);
        
        if fs::metadata(workdir).await.is_err() {
            log::info!("Creating workdir");
            fs::create_dir(workdir).await?;
        }

        if fs::metadata(&vocab_path).await.is_err() {
            let vocab_url = "https://huggingface.co/gpt2/raw/main/vocab.json";
            log::info!("Downloading vocab.json from {}", vocab_url);
            let response = reqwest::get(vocab_url).await?.bytes().await?;
            fs::write(&vocab_path, response).await?;
        }

        let merges_path = format!("{}/merges.txt", workdir);

        if fs::metadata(&merges_path).await.is_err() {
            let merges_url = "https://huggingface.co/gpt2/raw/main/merges.txt";
            log::info!("Downloading merges.txt from {}", merges_url);
            let response = reqwest::get(merges_url).await?.bytes().await?;
            fs::write(&merges_path, response).await?;
        }
        
        Ok(())
    }

    pub async fn new() -> anyhow::Result<Self> {
        GPT2Tokenizer::prepare_vocab().await?;

        let vocab_path = "workdir/vocab.json";
        let merges_path = "workdir/merges.txt";
        let bpe_builder = BPE::from_file(vocab_path, merges_path);
        let bpe = match bpe_builder
            .dropout(0.1)
            .unk_token("[UNK]".into())
            .build() {
                Ok(bpe) => bpe,
                Err(err) => { 
                    log::error!("Error while building BPE: {}", err);
                    bail!("Error while building BPE: {}", err)
                },
            };

        let mut tokenizer = Tokenizer::new(bpe);
        tokenizer.with_pre_tokenizer(ByteLevel::default());
        tokenizer.with_post_processor(ByteLevelProcessor::default());

        Ok(GPT2Tokenizer {
            tokenizer: tokenizer,
        })
    }

    pub fn count_tokens(&self, text: &str) -> anyhow::Result<usize> {
        let output = match self.tokenizer.encode(text, false) {
            Ok(output) => output,
            Err(err) => {
                log::error!("Error while encoding text: {}", err);
                bail!("Error while encoding text: {}", err)
            },
        };
        let token_count = output.get_tokens().len();
        Ok(token_count)
    }
}