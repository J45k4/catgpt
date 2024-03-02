import { useCallback, useState } from "react"
import { ws } from "./ws"
import {formatDateTime } from "./utility"
import { Row } from "./layout"
import { BiCopy } from "react-icons/bi"
import { CodeBlock } from "react-code-blocks"
import { BotSelect } from "./bot"
import { cache, notifyChanges, useCache } from "./cache"

const SendMessageBox = (props: {
    chatId?: string
}) => {
    const [msg, setMsg] = useState("")
    const botId = useCache(s => s.selectedBotId)

    const sendMsg = useCallback(() => {
        if (msg === "") {
            return
        }

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
            <textarea style={{ flexGrow: 1, fontSize: "25px", marginRight: "10px" , height: `${lineBreaks * 30}px`, overflow: "hidden", resize: "none" }}
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
            <BotSelect />
        </div>
    )
}

export const CurrentChat = () => {
    const msgs = useCache(cache => {
        const chat = cache.chats.get(cache.selectedChatId)
        return chat ? chat.msgs : []
    })

    return (
        <div className="segment">
            <div>
                {msgs.map((msg, index) => {
                    return (
                        <div style={{ 
                            display: "flex", 
                            flexDirection: "column", 
                            border: "solid 1px, black", 
                            marginBottom: "20px",
                            padding: "5px",
                            backgroundColor: index % 2 === 0 ? "#f6f6f6" : "white",
                        }}
                            key={msg.id}>
                            <div style={{ marginRight: "15px", whiteSpace: "nowrap", display: "flex", flexWrap: "wrap" }}>
                                <div style={{ flexGrow: 1, fontSize: "20px" }}>
                                    {msg.user}
                                </div>
                                <div>
                                    <Row style={{ flexWrap: "wrap" }}>
                                        {formatDateTime(msg.datetime)}
                                        Token Count:
                                        {msg.tokenCount}
                                        <BiCopy 
                                            style={{ fontSize: "25px", cursor: "pointer" }}
                                            onClick={() => {
                                                navigator.clipboard.writeText(msg.text)
                                            }}
                                        />
                                    </Row>    
                                </div>
                            </div>
                            <ChatMessage
                                key={msg.id}
                                msgId={msg.id}
                                text={msg.text}
                                />
                        </div>
                    )
                })}
                {/* <SendMessageBox chatId={chat?.id} /> */}
            </div>
        </div>
    )
}

export const ChatMessage = (props: {
    msgId: string
    text: string
}) => {
    const rows = []

    let backbuffer = ""
    let language = ""
    let parsingCodeBlock = false
    let parsingLanguage = false
    let blockCount = 1
    for (const char of props.text) {
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