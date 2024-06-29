import { ws } from "./ws"
import {formatDateTime } from "./utility"
import { Row } from "./layout"
import { BiCopy } from "react-icons/bi"
import { CodeBlock } from "react-code-blocks"
import { cache, notifyChanges, useCache } from "./cache"
import {AutoFocusPlugin} from '@lexical/react/LexicalAutoFocusPlugin';
import {LexicalComposer} from '@lexical/react/LexicalComposer';
import {RichTextPlugin} from '@lexical/react/LexicalRichTextPlugin';
import {ContentEditable} from '@lexical/react/LexicalContentEditable';
import {HistoryPlugin} from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useCallback, useLayoutEffect, useState } from "react"
import { $createParagraphNode, $createTextNode, $getRoot, EditorState } from "lexical"
import { Loader } from "./common"
import { FaRegStopCircle } from "react-icons/fa"
import { TbReload } from "react-icons/tb";

function onError(error) {
    console.error(error);
}

const MsgEditorContnet = () => {
    const { selectedBotId, selectedChatId, chatsGenerating } = useCache(cache => {
        return {
            selectedChatId: cache.selectedChatId,
            selectedBotId: cache.selectedBotId,
			chatsGenerating: cache.chatsGenerating.has(cache.selectedChatId)
        }
    })
    const [editor] = useLexicalComposerContext()

    const sendMsg = useCallback(() => {
        if (!cache.currentMsg) {
            return
        }

        ws.send({
            type: "SendMsg",
            botId: selectedBotId,
            txt: cache.currentMsg,
            chatId: selectedChatId
        })

		const chat = cache.chats.get(selectedChatId)

		if (chat) {
			chat.msgs.push({
				bot: false,
				chatId: selectedChatId,
				text: cache.currentMsg,
				datetime: new Date().toISOString(),
			})
		}

        cache.currentMsg = ""
        notifyChanges()
        editor.update(() => {
            const root = $getRoot()
            root.clear()
        })
    }, [editor, selectedBotId, selectedChatId])

	const stopGenerating = useCallback(() => {
		ws.send({
			type: "StopGeneration",
			chatId: selectedChatId
		})
	}, [selectedChatId])

    useLayoutEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                sendMsg()
            }
        }

        return editor.registerRootListener(
            (
                rootElement: null | HTMLElement,
                prevRootElement: null | HTMLElement,
            ) => {
                if (prevRootElement !== null) {
                    prevRootElement.removeEventListener('keydown', onKeyDown)
                }
                if (rootElement !== null) {
                    rootElement.addEventListener('keydown', onKeyDown)
                }
            }
        )
    }, [editor, sendMsg])

    return (
        <div style={{
            display: "flex",
			flexDirection: "row",
            border: "solid 1px rgba(0, 0, 0, 0.3)",
            outline: "none",
            padding: "0px"
        }}>
            <RichTextPlugin
                contentEditable={<ContentEditable style={{
                    flexGrow: 1,
                    margin: "0px",
                    padding: "10px",
                    outline: "none",
                }} />}
                placeholder={<div></div>}
                ErrorBoundary={LexicalErrorBoundary}
            />
			<div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
				{!chatsGenerating && (
				<button onClick={sendMsg}>
					Send
				</button>)}
				{chatsGenerating && (
					<button onClick={stopGenerating}>
						<FaRegStopCircle style={{ width: "20px", height: "20px" }} />
					</button>
				)}
			</div>
        </div>

    )
}

export const SendMessageBox = () => {
    const { currentMsg } = useCache(cache => {
        return {
            currentMsg: cache.currentMsg
        }
    })

    const onMsgChange = useCallback((editorState: EditorState) => {
        editorState.read(() => {
            const root = $getRoot()
            const text = root.getTextContent()
            cache.currentMsg = text
        })
    }, [])

    return (
        <div style={{ display: "flex" }}>
            <div style={{ flexGrow: 1 }}>
                <LexicalComposer initialConfig={{
                    namespace: "NewMessageEditor",
                    onError,
                    theme: {
                        paragraph: "editor-paragraph",
                    },
                    editorState(editor) {
                        editor.update(() => {
                            const root = $getRoot()
                            currentMsg.split("\n").forEach(line => {
                                const p = $createParagraphNode()
                                const text = $createTextNode(line)
                                p.append(text)
                                root.append(p)
                            })
                        })
                    },
                    
                }}>
                    <MsgEditorContnet />
                    <HistoryPlugin />
                    <AutoFocusPlugin />
                    <OnChangePlugin onChange={onMsgChange} />

                </LexicalComposer>
            </div>

        </div>
    )
}

export const EditMessageBox = (props: {
	text: string
}) => {
	// const [editing, setEditing] = useState(false)

	const onMsgChange = useCallback((editorState: EditorState) => {
		editorState.read(() => {
			const root = $getRoot()
			const text = root.getTextContent()
			cache.currentMsg = text
		})
	}, [])

	return (
		<div style={{ display: "flex" }}>
			<div style={{ flexGrow: 1 }}>
				<LexicalComposer initialConfig={{
					namespace: "NewMessageEditor",
					onError,
					theme: {
						paragraph: "editor-paragraph",
					},
					editorState(editor) {
						editor.update(() => {
							const root = $getRoot()
							props.text.split("\n").forEach(line => {
								const p = $createParagraphNode()
								const text = $createTextNode(line)
								p.append(text)
								root.append(p)
							})
						})
					},
					
				}}>
					<MsgEditorContnet />
					<HistoryPlugin />
					<AutoFocusPlugin />
					<OnChangePlugin onChange={onMsgChange} />
				</LexicalComposer>
			</div>

		</div>
	)
}

export const CurrentChat = () => {
	const [editing, setEditing] = useState(false)

    const msgs = useCache(cache => {
		if (!cache.selectedChatId) {
			return []
		}

        const chat = cache.chats.get(cache.selectedChatId)

		if (!chat) {
			return undefined
		}

		return chat.msgs
    })

    return (
        <div className="segment">
            <div>
				{!msgs && <Loader />}
                {msgs?.map((msg, index) => {
                    return (
                        <div style={{ 
                            display: "flex", 
                            flexDirection: "column", 
                            border: "solid 1px, #c4c4c4", 
                            marginBottom: "20px",
                            padding: "5px",
							paddingLeft: "10px",
                            backgroundColor: index % 2 === 0 ? "#f6f6f6" : "white",
                        }}
                            key={msg.id}>
                            <div style={{whiteSpace: "nowrap", display: "flex", flexWrap: "wrap" }}>
                                <div style={{ flexGrow: 1, fontSize: "20px" }}>
                                    {msg.user}
                                </div>
                                <div>
                                    <Row style={{ flexWrap: "wrap" }}>
										<label style={{ marginRight: "10px", fontSize: "17px" }}>
											{formatDateTime(msg.datetime)}
										</label>
                                        {/* Token Count:
                                        {msg.tokenCount} */}
                                        <BiCopy 
                                            className="icon"
                                            onClick={() => {
                                                navigator.clipboard.writeText(msg.text)
                                            }}
                                        />
										<TbReload className="icon" />
										{/* <BiSolidEditAlt
											style={{ fontSize: "25px", cursor: "pointer" }}
											onClick={() => setEditing(true)} /> */}
                                    </Row>    
                                </div>
                            </div>
							{editing &&
							<EditMessageBox text={msg.text} />}
							{!editing &&
                            <ChatMessage
                                key={msg.id}
                                msgId={msg.id}
                                text={msg.text}
                                />}
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
				parsingCodeBlock = false
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
        <div style={{ display: "flex", flexDirection: "column", overflow: "auto" }} onTouchStart={e => e.stopPropagation()}>
            {rows}
        </div>
    )
}