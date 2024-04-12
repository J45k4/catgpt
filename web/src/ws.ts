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
    ws_socket = new WebSocket(url)
    ws_socket.onopen = () => {
        ws.connected = true
        cache.connected = true
		notifyChanges()
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
			cache.initialLoading = false
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
            }
            cache.version = msg.version
            cache.authenticated = true
            notifyChanges()
        }

        if (msg.type === "AuthTokenInvalid") {
			cache.initialLoading = false
            cache.authFailed = true
            notifyChanges()
        }

        if (msg.type === "ChatMetas") {
            for (const meta of msg.metas) {
                if (cache.chats.has(meta.id)) {
                    continue
                }

                cache.chats.set(meta.id, {
                    id: meta.id,
                    title: meta.title,
                    lastMsgDatetime: meta.lastMsgDatetime,
                })
            }
			cache.chatsLoaded = true
            notifyChanges()
        }

        if (msg.type === "Chat") {
            let chat = cache.chats.get(msg.id)

			if (!chat) {
				chat = {
					id: msg.id,
					title: msg.title,
					lastMsgDatetime: msg.msgs[msg.msgs.length - 1].datetime,
				}
				cache.chats.set(msg.id, chat)
			}

			chat.msgs = msg.msgs

			// localStorage.setItem(`chat:${msg.id}`, JSON.stringify(msg))
            notifyChanges()
        }

        if (msg.type === "Bots") {
            cache.bots = msg.bots
			localStorage.setItem("bots", JSON.stringify(msg.bots))
            cache.bots.sort((a, b) => a.id.localeCompare(b.id))
			if (!cache.bots.find(b => b.id === cache.selectedBotId)) {
				cache.selectedBotId = cache.bots.find(b => b.name === "aki")?.id ?? cache.bots[0]?.id ?? ""
			} 
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
            })
            notifyChanges()
        }

        if (msg.type === "ChatCreated") {
            cache.chats.set(msg.chat.id, {
                id: msg.chat.id,
                lastMsgDatetime: new Date().toISOString(),
                title: msg.chat.title,
            })
            cache.selectedChatId = msg.chat.id
            notifyChanges()
        }

        if (msg.type === "NewMsg") {
            const chat = cache.chats.get(msg.msg.chatId)
            if (chat) {
				if (!chat.msgs) {
					chat.msgs = []
				}

				chat.msgs = chat.msgs.filter(p => p.id != null)

                let chatMsg = chat.msgs.find(m => m.id === msg.msg.id)

                if (!chatMsg) {
                    chatMsg = msg.msg
                    chat.msgs.push(chatMsg)
                } else {
                    chatMsg.text = msg.msg.text
                    chatMsg.tokenCount = msg.msg.tokenCount
                    chatMsg.datetime = msg.msg.datetime
                }

                chat.lastMsgDatetime = msg.msg.datetime
                notifyChanges()
            }
        }


        if (msg.type === "MsgDelta") {
            const chat = cache.chats.get(msg.chatId)
            if (chat) {
                const message = chat.msgs.find(m => m.id === msg.msgId)
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

