import { useEffect, useMemo, useState } from "react"
import { state } from "./state"
import { events } from "./events"
import { ChatMeta } from "./types"
import "./chat_list.css"
import { updateQueryParam } from "./utility"
import { ws } from "./ws"
import { useImmer } from "use-immer"

export const ChatsList = () => {
    const [chatMetas, setChatMetas] = useImmer(state.chatMetas)

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
        <div style={{ maxWidth: "800px", maxHeight: "500px", overflow: "auto" }} className="segment">
            {groups.map(group => (
                <div key={group.date}>
                    <h3>{group.date}</h3>
                    {group.chats.map(chat => (
                        <div key={chat.id} style={{ cursor: "pointer" }} className="chatListItem"
                            onClick={() => {
                                updateQueryParam("chatId", chat.id)
                                state.selectedChatId = chat.id
                                ws.send({
                                    type: "GetChat",
                                    chatId: chat.id,
                                })
                            }}>
                            {chat.title ? chat.title : chat.id}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}
