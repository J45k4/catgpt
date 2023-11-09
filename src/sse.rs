
#[derive(Debug)]
pub enum SSEvent {
    Data(String),
    Done
}

pub struct SSEventParser {
    buffer: String,
}

impl SSEventParser {
    pub fn new() -> Self {
        SSEventParser {
            buffer: String::new(),
        }
    }

    pub fn add_chunk(&mut self, chunk: &str) {
        self.buffer.push_str(chunk);
    }

    pub fn parse_events(&mut self) -> Vec<SSEvent> {
        let mut events = Vec::new();
        let mut parsing_event = false;
        let mut parsing_start_index = 0;
        let mut index = 0;
    
        let char_indices: Vec<_> = self.buffer.char_indices().collect();
    
        for (i, ch) in char_indices.iter() {
            if parsing_event {
                // Look for a newline character to signify the end of an event
                if *ch == '\n' {
                    let event_str = self.buffer[parsing_start_index..*i].trim();
    
                    if event_str == "[DONE]" {
                        events.push(SSEvent::Done);
                    } else {
                        events.push(SSEvent::Data(event_str.to_string()));
                    }
    
                    index = *i + 1;
                    parsing_event = false;
                }
                continue;
            }
    
            // Check for the start of a new event
            if self.buffer[*i..].starts_with("data:") {
                parsing_event = true;
                parsing_start_index = *i + 5; // Skip "data:"
                continue;
            }
        }
    
        // Update buffer to remove processed events
        if index > 0 {
            self.buffer = self.buffer[index..].to_string();
        }
    
        events
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_events() {
        let s = r#"
        data: {"object":"chat.completion.chunk","created":1690021109,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

        data: {"object":"chat.completion.chunk","created":1690021109,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"content":"The"},"finish_reason":null}]
        "#;

        let mut reader = SSEventParser::new();
        reader.add_chunk(s);
        let events = reader.parse_events();
        assert_eq!(events.len(), 2);

        match &events[0] {
            SSEvent::Data(data) => {
                assert!(data.contains("assistant"));
            },
            _ => panic!("Expected SSEvent::Data"),
        }

        match &events[1] {
            SSEvent::Data(data) => {
                assert!(data.contains("The"));
            },
            _ => panic!("Expected SSEvent::Data"),
        }
    }

    #[test]
    fn test_unfinished_event() {
        let s = r#"data: {"object":"c"#;
        let mut reader = SSEventParser::new();
        reader.add_chunk(s);
        let events = reader.parse_events();
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn test_finish_event() {
        let chunk_1 = r#"data: {"name":"#;
        let chunk_2 = r#""teppo","age":42}
        "#;
        let mut reader = SSEventParser::new();
        reader.add_chunk(chunk_1);
        let events = reader.parse_events();
        assert_eq!(events.len(), 0);
        reader.add_chunk(chunk_2);
        let events = reader.parse_events();
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn test_parse_one_leave_rest() {
        let chunk_1 = r#"data: {"name":""teppo","age":42}
        
        data: {"name":"#;
        let chunk_2 = r#":"matti","age":43}
        "#;
        let mut reader = SSEventParser::new();
        reader.add_chunk(chunk_1);
        let events = reader.parse_events();
        assert_eq!(events.len(), 1);
        reader.add_chunk(chunk_2);
        let events = reader.parse_events();
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn test_works_with_emojis() {
        let chunk = r#"data: {"object":"chat.completion.chunk","created":1699515189,"model":"gpt-4-1106-preview","choices":[{"index":0,"delta":{"content":" 😺"},"finish_reason":null}]}
    
        "#;

        let mut reader = SSEventParser::new();
        reader.add_chunk(chunk);
        let events = reader.parse_events();
        assert_eq!(events.len(), 1);
    }
}