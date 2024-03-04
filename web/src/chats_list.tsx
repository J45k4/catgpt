import { ChatMeta } from "../../types"
import "./chat_list.css"
import { Row } from "./layout"
import { ws } from "./ws"
import { cache, notifyChanges, useCache } from "./cache"
import { updateQueryParam } from "./utility"

export const ChatsList = () => {
    const chats = useCache(s => Array.from(s.chats.values()))
    const groupedChats = new Map<string, ChatMeta[]>()
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()

    for (const c of chats) {
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

        group.push(c as any)
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

    return (
        <div className="segment" style={{ }}>
            <Row>
                {cache.selectedChatId && 
                <button onClick={() => {
                    if (!cache.selectedChatId) {
                        return
                    }

                    ws.send({
                        type: "GenTitle",
                        chatId: cache.selectedChatId
                    })
                }}>
                    Regenerate Title
                </button>}
                {cache.selectedChatId &&
                <button onClick={() => {
                    cache.selectedChatId = null
                    updateQueryParam("chatId", undefined)
					cache.pageInx = 1
                    notifyChanges()
                }}>
                    New Chat
                </button>}
            </Row>
            <div style={{ overflow: "auto" }}>
                {groupsArray.map(group => (
                    <div key={group.date}>
                        <h3>{group.date}</h3>
                        {group.chats.map(chat => (
                            <div key={chat.id} style={{ cursor: "pointer", border: cache.selectedChatId === chat.id ? "solid 1px black" : undefined  }} className="chatListItem"
                                onClick={() => {
                                    ws.send({
                                        type: "GetChat",
                                        chatId: chat.id
                                    })
                                    updateQueryParam("chatId", chat.id)
                                    cache.selectedChatId = chat.id
                                    cache.pageInx = 1
                                    notifyChanges()
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
