import { MsgFromSrv, MsgToSrv } from "./types";

let ws_socket: WebSocket

let on_open: () => void = () => {}
let on_close: () => void = () => {}
let on_msg: (msg: MsgFromSrv) => void = () => {}

const createConn = () => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    const host = window.location.host
    const url = `${protocol}://${host}/ws`
    console.log("ws url", url)
    ws_socket = new WebSocket(url)

    ws_socket.onopen = () => {
        console.log("onopen")
        on_open()
    }

    ws_socket.onclose = () => {
        console.log("onclose")
        on_close()

        setTimeout(() => {
            createConn()
        }, 1000)
    }

    ws_socket.onmessage = data => {
        const msg = JSON.parse(data.data)
        on_msg(msg)
    }
}

createConn()

export const ws = {
    send: (msg: MsgToSrv) => {
        let text = JSON.stringify(msg)
        ws_socket.send(text)
    },
    set on_open(f: () => void) {
        on_open = f
    },
    set on_close(f: () => void) {
        on_close = f
    },
    set on_msg(f: (msg: MsgFromSrv) => void) {
        on_msg = f
    }
}