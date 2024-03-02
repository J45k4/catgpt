import { ChatMsg, MsgFromSrv, MsgToSrv } from "../../types";
import { cache, notifyChanges } from "./cache";

let ws_socket: WebSocket

export const ws = {
    send: (msg: MsgToSrv) => {
        const text = JSON.stringify(msg)
        ws_socket.send(text)
    },
    disconnect: () => {
        if (!ws_socket) {
            return
        }

        ws_socket.close()
    },
    connected: false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clearTimer: any
const clearGeneralError = () => {
    if (clearTimer) {
        clearTimeout(clearTimer)
    }

    clearTimer = setTimeout(() => {
        cache.generalErrorMsg = ""
        notifyChanges()
    }, 5000)
}

export const createConn = () => {
    let url
    if (import.meta.env.DEV) {
        url = `ws://localhost:5566/ws`
        ws_socket = new WebSocket(url)
    } else {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws"
        const host = window.location.host
        url = `${protocol}://${host}/ws`
    }
    console.log("ws url", url)
    ws_socket = new WebSocket(url)

    ws_socket.onopen = () => {
        ws.connected = true
        cache.connected = true

        ws.send({
            type: "Authenticate",
            token: localStorage.getItem("token") ?? ""
        })
    }

    ws_socket.onclose = () => {
        ws.connected = false
        cache.authenticated = false
        cache.connected = false

        setTimeout(() => {
            createConn()
        }, 1000)
    }

    ws_socket.onmessage = data => {
        const msg = JSON.parse(data.data) as MsgFromSrv

        if (msg.type === "error") {
            cache.generalErrorMsg = msg.error.message
            notifyChanges()
            clearGeneralError()
        }

        if (msg.type === "Authenticated") {
            localStorage.setItem("token", msg.token)

            ws.send({
                type: "GetChats"
            })

            ws.send({
                type: "GetBots"
            })

            if (cache.selectedChatId) {
                ws.send({
                    type: "GetChat",
                    chatId: cache.selectedChatId
                })
            }

            if (cache.version && cache.version !== msg.version) {
                window.location.reload()
            } else {
                cache.version = msg.version
            }

            cache.authenticated = true
            notifyChanges()
        }

        if (msg.type === "AuthTokenInvalid") {
            cache.authFailed = true
            notifyChanges()
        }

        if (msg.type === "ChatMetas") {
            for (const meta of msg.metas) {
                cache.chats.set(meta.id, {
                    id: meta.id,
                    title: meta.title,
                    lastMsgDatetime: meta.lastMsgDatetime,
                    msgs: []
                })
            }
            notifyChanges()
        }

        if (msg.type === "Chat") {
            const chat = cache.chats.get(msg.id)
            chat.msgs = msg.messages
            notifyChanges()
        }

        if (msg.type === "Bots") {
            cache.bots = msg.bots
            cache.bots.sort((a, b) => a.id.localeCompare(b.id))
            cache.selectedBotId = msg.bots[0]?.id ?? ""
            notifyChanges()
        }

        if (msg.type === "Bot") {
            const existingBot = cache.bots.find(b => b.id === msg.id)

            if (existingBot) {
                existingBot.name = msg.name
                existingBot.model = msg.model
                existingBot.instructions = msg.instructions
            } else {
                cache.bots.push(msg)
            }

            notifyChanges()
        }

        // if (msg.type === "MsgDelta") {
        //     const chat = cache.chats.get(msg.chatId)
        //     if (chat) {
        //         const chatMsg = chat.msgs.find(m => m.id === msg.msgId)

        //         if (chatMsg) {
        //             chatMsg.text += msg.delta
        //         }
        //     }
        // }

        if (msg.type === "NewChat") {
            cache.chats.set(msg.chat.id, {
                id: msg.chat.id,
                title: msg.chat.title,
                lastMsgDatetime: new Date().toISOString(),
                msgs: []
            })
            notifyChanges()
        }

        if (msg.type === "ChatCreated") {
            cache.chats.set(msg.chat.id, {
                id: msg.chat.id,
                lastMsgDatetime: new Date().toISOString(),
                title: msg.chat.title,
                msgs: []
            })
            cache.selectedChatId = msg.chat.id
            notifyChanges()
        }

        if (msg.type === "NewMsg") {
            const chat = cache.chats.get(msg.msg.chatId)
            if (chat) {
                chat.msgs.push(msg.msg)
                chat.lastMsgDatetime = msg.msg.datetime
                notifyChanges()
            }
        }


        if (msg.type === "MsgDelta") {
            const chat = cache.chats.get(msg.chatId)
            if (chat) {
                const message: ChatMsg = chat.msgs.find(m => m.id === msg.msgId)
                if (message) {
                    message.text += msg.delta
                    notifyChanges()
                }
            }
        }

        if (msg.type === "TitleDelta") {
            const chat = cache.chats.get(msg.chatId)
            if (chat) {
                if (chat.title) {
                    chat.title += msg.delta
                } else {
                    chat.title = msg.delta
                }
                notifyChanges()
            }
        }
    }
}

