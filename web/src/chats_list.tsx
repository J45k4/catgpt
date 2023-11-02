import { useEffect, useMemo } from "react"
import { state } from "./state"
import { events } from "./events"
import { ChatMeta } from "./types"
import "./chat_list.css"
import { useImmer } from "use-immer"
import { useSelectedChatId } from "./hooks"
import { Row } from "./layout"
import { ws } from "./ws"

export const ChatsList = () => {
    const [chatMetas, setChatMetas] = useImmer(state.chatMetas)
    const [selectedChatId, setSelectedChatId] = useSelectedChatId()

    useEffect(() => {
        const sub = events.subscribe({
            next: (e) => {
                if (e.type === "ChatMetas") {
                    setChatMetas(e.metas)
                }

                if (e.type === "NewChat") {
                    setChatMetas(draft => {
                        draft.push({
                            id: e.chat.id,
                            lastMsgDatetime: new Date().toISOString(),
                            title: e.chat?.title,
                            type: "ChatMeta"
                        })
                    })
                }

                if (e.type === "TitleDelta") {
                    setChatMetas(draft => {
                        const chatMeta = draft.find(c => c.id === e.chatId)

                        if (chatMeta) {
                            if (!chatMeta.title) {
                                chatMeta.title = ""
                            }

                            chatMeta.title += e.delta
                        }
                    })
                }
            },
        })

        return () => {
            sub.unsubscribe()
        }
    }, [setChatMetas])

    const groups = useMemo(() => {
        const groupedChats = new Map<string, ChatMeta[]>()

        const today = new Date().toDateString()
        const yesterday = new Date(Date.now() - 86400000).toDateString()

        for (const c of chatMetas) {
            const lastMsgDate = new Date(c.lastMsgDatetime).toDateString()
            let groupKey

            if (lastMsgDate === today) {
                groupKey = "Today"
            } else if (lastMsgDate === yesterday) {
                groupKey = "Yesterday"
            } else {
                groupKey = lastMsgDate
            }

            let group = groupedChats.get(groupKey)

            if (!group) {
                group = []
                groupedChats.set(groupKey, group)
            }

            group.push(c)
        }

        // Sort each group
        for (const group of groupedChats.values()) {
            group.sort((a, b) => {
                return new Date(b.lastMsgDatetime).getTime() - new Date(a.lastMsgDatetime).getTime()
            })
        }

        // Transform the Map into a list of grouped chats
        const groupsArray = [...groupedChats.entries()].map(([date, chats]) => ({ date, chats }))

        // Sort the date groups
        groupsArray.sort((a, b) => {
            if (a.date === "Today") return -1
            if (b.date === "Today") return 1
            if (a.date === "Yesterday") return -1
            if (b.date === "Yesterday") return 1
            return new Date(b.date).getTime() - new Date(a.date).getTime()
        })

        return groupsArray
    }, [chatMetas])

    return (
        <div style={{ maxWidth: "800px"}} className="segment">
            <Row>
                {selectedChatId && 
                <button onClick={() => {
                    ws.send({
                        type: "GenTitle",
                        chatId: selectedChatId
                    })
                }}>
                    Regenerate Title
                </button>}
                {selectedChatId &&
                <button onClick={() => {
                    setSelectedChatId(null)
                }}>
                    New Chat
                </button>}
            </Row>
            <div style={{ overflow: "auto", maxHeight: "500px" }}>
                {groups.map(group => (
                    <div key={group.date}>
                        <h3>{group.date}</h3>
                        {group.chats.map(chat => (
                            <div key={chat.id} style={{ cursor: "pointer", border: selectedChatId === chat.id ? "solid 1px black" : undefined  }} className="chatListItem"
                                onClick={() => {
                                    setSelectedChatId(chat.id)
                                }}>
                                {chat.title ? chat.title : chat.id}
                            </div>
                        ))}
                    </div>
                ))}
            </div>  
        </div>
    )
}
