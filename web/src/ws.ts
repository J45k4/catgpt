import { events } from "./events";
import { state } from "./state";
import { MsgFromSrv, MsgToSrv } from "./types";

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

export const createConn = () => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    // const host = window.location.host
    const url = `${protocol}://localhost:5566/ws`
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
        console.log("onmessage", msg)

        if (msg.type === "Authenticated") {
            localStorage.setItem("token", msg.token)
            state.authenticated = true

            ws.send({
                type: "GetChats"
            })

            if (state.selectedChatId) {
                ws.send({
                    type: "GetChat",
                    chatId: state.selectedChatId
                })
            }
        }

        if (msg.type === "ChatMetas") {
            state.chatMetas = msg.metas
        }

        if (msg.type === "Chat") {
            state.currentChat = msg
        }
    }
}

