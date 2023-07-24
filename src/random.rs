use std::time::Duration;

use rand::seq::SliceRandom;
use tokio::fs;
use tokio::time::sleep;

use crate::types::Context;
use crate::types::Event;
use crate::types::MsgDelta;

fn pick_random_item<T>(items: &[T]) -> Option<&T> {
    if items.is_empty() {
        None
    } else {
        let mut rng = rand::thread_rng();
        Some(items.choose(&mut rng).unwrap())
    }
}


pub async fn create_random_resp(ctx: Context) {
    let vocabulary = fs::read_to_string("./vocabulary.txt").await.unwrap();
    let words = vocabulary.lines().collect::<Vec<_>>();

    let number_of_words = 50;

    // let mut sequence = Vec::with_capacity(number_of_words);

    let msg_id = uuid::Uuid::new_v4().to_string().replace("-", "");

    for _ in 0..number_of_words {
        let word = pick_random_item(&words).unwrap();

        let e = Event::MsgDelta(
            MsgDelta {
                author: "Random".to_string(),
                delta: format!("{} ", word.to_string()),
                msg_id: msg_id.clone(),
            }
        );
        
        match ctx.ch.send(e) {
            Ok(_) => {},
            Err(err) => {
                println!("err: {:?}", err);
            },
        }

        sleep(Duration::from_millis(100)).await;
    }

    
}