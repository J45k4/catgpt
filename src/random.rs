use std::time::Duration;

use chrono::Utc;
use rand::seq::SliceRandom;
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
    let vocabulary = include_str!("../vocabulary.txt");
    let words = vocabulary.lines().collect::<Vec<_>>();

    let mut chat = ctx.db.get_chat(&chat_id).await.unwrap();

    let number_of_words = 50;

    let msg_id = Uuid::new_v4().to_string();

    let mut new_msg = ChatMsg {
        id: msg_id.clone(),
        chat_id: chat_id.clone(),
        datetime: Utc::now(),
        message: "".to_string(),
        bot: true,
        user: "random".to_string(),
        user_id: "random".to_string()
    };
    
    ctx.ch.send(Event::NewMsg { msg: new_msg.clone() }).unwrap();

    for _ in 0..number_of_words {
        let word = pick_random_item(&words).unwrap();

        new_msg.message.push_str(&format!("{} ", word));

        let e = Event::MsgDelta(
            MsgDelta {
                chat_id: chat_id.clone(),
                delta: format!("{} ", word),
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

    chat.messages.push(new_msg.clone());
    ctx.db.save_chat(chat).await;
    ctx.db.save_changes().await;
}