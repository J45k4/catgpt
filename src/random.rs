use std::time::Duration;

use chrono::Utc;
use rand::seq::SliceRandom;
use tokio::fs;
use tokio::time::sleep;
use uuid::Uuid;

use crate::types::ChatMsg;
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


pub async fn create_random_resp(ctx: Context, chat_id: String) {
    let vocabulary = fs::read_to_string("./vocabulary.txt").await.unwrap();
    let words = vocabulary.lines().collect::<Vec<_>>();

    let number_of_words = 50;

    let msg_id = Uuid::new_v4().to_string();

    let mut new_msg = ChatMsg {
        id: msg_id.clone(),
        chat_id: chat_id.clone(),
        datetime: Utc::now(),
        message: "".to_string(),
        bot: true,
        user: "Random".to_string()
    };
    
    ctx.ch.send(Event::NewMsg { msg: new_msg.clone() });

    for _ in 0..number_of_words {
        let word = pick_random_item(&words).unwrap();

        new_msg.message.push_str(&format!("{} ", word.to_string()));

        let e = Event::MsgDelta(
            MsgDelta {
                chat_id: chat_id.clone(),
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

        sleep(Duration::from_millis(20)).await;
    }

    ctx.db.save_msg(new_msg).await;
}