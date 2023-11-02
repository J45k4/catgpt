import { useCallback, useEffect, useState } from "react"
import { state } from "./state"
import { events } from "./events"
import { ws } from "./ws"
import { clearQueryParam, formatDateTime } from "./utility"
import { useImmer } from "use-immer"
import { Row } from "./layout"

const ModelSelect = (props: {
    model: string
    onChange: (model: string) => void
}) => {
    return (
        <select style={{ fontSize: "20px" }} value={props.model} onChange={e => props.onChange(e.target.value)}>
            <option value="gpt3.5">Gpt3</option>
            <option value="gpt4">Gpt4</option>
            <option value="random">Random</option>
        </select>
    )
}

const SendMessageBox = (props: {
    chatId?: string
    model: string
}) => {
    const [msg, setMsg] = useState("")

    const sendMsg = useCallback(() => {
        if (msg === "") {
            return
        }

        console.log("sending msg", msg)

        ws.send({
            type: "SendMsg",
            model: props.model,
            chatId: props.chatId,
            txt: msg
        })

        setMsg("")
    }, [msg, props.chatId, props.model])

    return (
        <div style={{ display: "flex" }}>
            <input style={{ flexGrow: 1, fontSize: "25px", width: "100%", marginRight: "10px" }}
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => {
                    if (e.key === "Enter") {
                        sendMsg()
                    }
                }}
                />
            <button onClick={() => {
                sendMsg()
            }}>
                Send
            </button>
        </div>
)
}

export const CurrentChat = () => {
    const [chat, setChat] = useImmer(state.currentChat)
    const [model, setModel] = useState("gpt3.5")

    useEffect(() => {
        const sub = events.subscribe({
            next: (event) => {
                if (event.type === "Chat") {
                    setChat(event)
                }

                if (event.type === "NewMsg") {
                    setChat(draft => {
                        if (draft) {
                            draft.messages.push(event.msg)
                        }
                    })
                
                }
            }
        })

        return () => {
            sub.unsubscribe()
        }
    }, [setChat])

    return (
        <div className="segment">
            <div style={{ display: "flex" }}>
                <div style={{ marginRight: "15px", fontSize: "20px" }}>
                    Current Chat
                </div>
                <div>
                    <ModelSelect model={model} onChange={setModel} />
                </div>
                <div>
                    <button onClick={() => {
                        setChat(null)
                        clearQueryParam("chatId")
                    }}>
                        New Chat
                    </button>
                </div>
            </div>
            <div>
                {chat?.messages.map((message, index) => {
                    return (
                        <div style={{ 
                            display: "flex", 
                            flexDirection: "column", 
                            border: "solid 1px, black", 
                            marginBottom: "20px",
                            padding: "5px",
                            backgroundColor: index % 2 === 0 ? "#f6f6f6" : "white",
                        }}
                            key={message.id}>
                            <div style={{ marginRight: "15px", whiteSpace: "nowrap", display: "flex" }}>
                                <div style={{ flexGrow: 1, fontSize: "25px" }}>
                                    {message.user}
                                </div>
                                <div>
                                    <Row>
                                        {formatDateTime(message.datetime)}
                                        Token Count:
                                        {message.tokenCount}
                                    </Row>    
                                </div>
                            </div>
                            <ChatMessage
                                msgId={message.id}
                                text={message.message}
                                />
                        </div>
                    )
                })}
            </div>
            <SendMessageBox model={model} chatId={chat?.id} />
        </div>
    )
}

const ChatMessage = (props: {
    msgId: string
    text: string
}) => {
    const [text, setText] = useImmer(props.text)

    useEffect(() => {
        const sub = events.subscribe({
            next: (event) => {
                if (event.type === "MsgDelta") {
                    if (props.msgId === event.msgId) {
                        setText(draft => draft + event.delta)
                    }
                }
            }
        })

        return () => {
            sub.unsubscribe()
        }
    }, [setText, props.msgId])

    return (
        <div>
            {text}
        </div>
    )
}