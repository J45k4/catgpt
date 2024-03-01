import { events } from "./events";
import { state } from "./state";
import { MsgFromSrv, MsgToSrv } from "../../types";
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
        console.log("onopen")
        ws.connected = true
        events.next({
            type: "connected"
        })

        ws.send({
            type: "Authenticate",
            token: localStorage.getItem("token") ?? ""
        })
    }

    ws_socket.onclose = () => {
        console.log("onclose")
        ws.connected = false
        state.authenticated = false
        events.next({
            type: "disconnected"
        })

        setTimeout(() => {
            createConn()
        }, 1000)
    }

    ws_socket.onmessage = data => {
        const msg = JSON.parse(data.data) as MsgFromSrv
        events.next(msg)

        console.log("received", msg)

        if (msg.type === "error") {
            cache.generalErrorMsg = msg.error.message
            notifyChanges()
            clearGeneralError()
        }

        if (msg.type === "Authenticated") {
            localStorage.setItem("token", msg.token)
            state.authenticated = true

            ws.send({
                type: "GetChats"
            })

            ws.send({
                type: "GetBots"
            })

            if (state.selectedChatId) {
                ws.send({
                    type: "GetChat",
                    chatId: state.selectedChatId
                })
            }

            if (state.version != null && state.version !== msg.version) {
                window.location.reload()
            } else {
                state.version = msg.version
            }
        }

        if (msg.type === "ChatMetas") {
            state.chatMetas = msg.metas
        }

        if (msg.type === "Chat") {
            state.currentChat = msg
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
    }
}

