import { useCallback, useEffect, useState } from "react"
import { state } from "./state"
import { events } from "./events"
import { ws } from "./ws"
import {formatDateTime } from "./utility"
import { useImmer } from "use-immer"
import { Row } from "./layout"
import { BiCopy } from "react-icons/bi"
import { CodeBlock } from "react-code-blocks"
import { BotSelect } from "./bot"
import { cache, notifyChanges, useCache } from "./cache"

const SendMessageBox = (props: {
    chatId?: string
    model: string
}) => {
    const [msg, setMsg] = useState("")
    const botId = useCache(s => s.selectedBotId)

    const sendMsg = useCallback(() => {
        if (msg === "") {
            return
        }

        console.log("sending msg", msg)

        ws.send({
            type: "SendMsg",
            botId,
            chatId: props.chatId,
            txt: msg
        })

        setMsg("")
    }, [botId, msg, props.chatId])

    const lineBreaks = msg.split("\n").length || 1

    return (
        <div style={{ display: "flex" }}>
            <textarea style={{ flexGrow: 1, fontSize: "25px", width: "100%", marginRight: "10px" , height: `${lineBreaks * 30}px`, overflow: "hidden", resize: "none" }}
                value={msg}
                rows={lineBreaks}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => {
                    if (!e.shiftKey && lineBreaks == 1 && e.key === "Enter") {
                        e.preventDefault()
                        sendMsg()
                    }
                }}
                />
            <button onClick={() => {
                sendMsg()
            }}>
                Send
            </button>
            <BotSelect botId={botId} onSetBotId={(botId) => {
                cache.selectedBotId = botId
                notifyChanges()
            }} />
        </div>
    )
}

export const CurrentChat = () => {
    const [chat, setChat] = useImmer(state.currentChat)
    const [model,] = useState("gpt3.5")

    useEffect(() => {
        const sub = events.subscribe({
            next: (event) => {
                if (event.type === "Chat") {
                    setChat(event)
                }

                if (event.type === "NewMsg") {
                    setChat(draft => {
                        if (draft && draft.id === event.msg.chatId) {
                            draft.messages.push(event.msg)
                        }
                    })
                
                }

                if (event.type === "ChatCreated") {
                    setChat(event.chat)
                }

                if (event.type === "selectedChatChanged") {
                    if (!event.chatId) {
                        setChat(null)
                    }
                }

                if (event.type === "GenerationDone") {
                    setChat(draft => {
                        if (draft) {
                            for (const msg of draft.messages) {
                                if (msg.id === event.msgId) {
                                    msg.tokenCount = event.tokenCount
                                }
                            }
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
            <div style={{ display: "flex", marginBottom: "10px"}}>
                <div style={{ marginRight: "15px", fontSize: "25px" }}>
                    Current Chat
                </div>
                {/* <div>
                    <ModelSelect model={model} onChange={setModel} />
                </div> */}
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
                            <div style={{ marginRight: "15px", whiteSpace: "nowrap", display: "flex", flexWrap: "wrap" }}>
                                <div style={{ flexGrow: 1, fontSize: "25px" }}>
                                    {message.user}
                                </div>
                                <div>
                                    <Row style={{ flexWrap: "wrap" }}>
                                        {formatDateTime(message.datetime)}
                                        Token Count:
                                        {message.tokenCount}
                                        <BiCopy 
                                            style={{ fontSize: "25px", cursor: "pointer" }}
                                            onClick={() => {
                                                navigator.clipboard.writeText(message.text)
                                            }}
                                        />
                                    </Row>    
                                </div>
                            </div>
                            <ChatMessage
                                msgId={message.id}
                                text={message.text}
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

                if (event.type === "GenerationDone") {
                    if (event.msgId === props.msgId) {
                        setText(event.msg)
                    }
                }
            }
        })

        return () => {
            sub.unsubscribe()
        }
    }, [setText, props.msgId])

    const rows = []

    let backbuffer = ""
    let language = ""
    let parsingCodeBlock = false
    let parsingLanguage = false
    let blockCount = 1
    for (const char of text) {
        backbuffer += char

        if (parsingCodeBlock) {
            if (backbuffer.endsWith("```")) {
                const code = backbuffer.slice(0, backbuffer.length - 3)

                rows.push(
                    <div style={{ marginBottom: "15px" }}>
                        <div style={{ display: "flex" }}>
                            <div style={{ flexGrow: 1 }}>
                                {language}
                            </div>
                            <div>
                                <BiCopy style={{ margin: "5px", fontSize: "20px", cursor: "pointer" }}
                                    onClick={() => navigator.clipboard.writeText(code)} />
                            </div>
                        </div>
                        
                        <CodeBlock key={blockCount++} text={code}
                            language={language} 
                            
                            />
                    </div>   
                )
                backbuffer = ""
            }
            continue
        }

        if (parsingLanguage) {
            if (backbuffer.endsWith("\n")) {
                language = backbuffer.slice(0, backbuffer.length - 1)
                parsingLanguage = false
                parsingCodeBlock = true
                backbuffer = ""
            }

            continue
        }

        if (backbuffer.endsWith("```")) {
            parsingLanguage = true
            backbuffer = ""
            continue
        }

        if (char === "\n") {
            rows.push(
                <div key={blockCount++} style={{ whiteSpace: "pre-wrap" }}>
                    {backbuffer}
                </div>
            )

            backbuffer = ""
            continue
        }
    }

    if (backbuffer !== "") {
        rows.push(
            <div key={blockCount++} style={{ whiteSpace: "pre-wrap" }}>
                {backbuffer}
            </div>
        )
    }

    return (
        <div>
            {rows}
        </div>
    )
}