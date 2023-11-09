
#[derive(Debug)]
pub enum SSEvent {
    Data(String),
    Done
}

pub fn parse_events(str: &str) -> Vec<SSEvent>  {
    log::info!("Parsing SSE events {}", str);
    let mut res = vec![];

    for row in str.split('\n').map(|p| p.trim()).filter(|p| !p.is_empty()) {
        if row.starts_with("data:") {
            let data = &row[6..];

            if data == "[DONE]" {
                res.push(SSEvent::Done);
            } else {
                res.push(SSEvent::Data(data.to_string()));
            }
        }
    }

    res
}

#[test]
fn test_parse_events() {
    let s = r#"
    data: {"id":"chatcmpl-7f3yvUlyj9S9ICTYvRkf12A0wfK11","object":"chat.completion.chunk","created":1690021109,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

    data: {"id":"chatcmpl-7f3yvUlyj9S9ICTYvRkf12A0wfK11","object":"chat.completion.chunk","created":1690021109,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"content":"The"},"finish_reason":null}]}
    "#;

    let events = parse_events(s);

    println!("{:?}", events);
}