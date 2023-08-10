import { v4 } from "uuid"

type MsgDelta = {
    type: "MsgDelta"
    msgId: string
    delta: string
    index:  number
    author: string
}

type StartWriting = {
    type: string
}

type FinishWrite = {
    type: string
}

type ChatMsg = {
    id: string,
    message: string,
    user: string,
    datetime: string,
    bot: boolean
}

type Chat = {
    type: "Chat"
    id: string
    title: String
    messages: ChatMsg[]
}

type Chats = {
    type: "Chats"
    chats: Chat[]
}

type ChatIds = {
    type: "ChatIds"
    ids: string[]
}

type MsgFromSrv = MsgDelta | Chats | ChatIds | Chat

type SendMsg = {
    type: "SendMsg"
    chatId: string
    msgCliId: string
    txt: string
    model: string
    instructions?: string
}

type StopGen = {
    type: "StopGen"
}

type GetChats = {
    type: "GetChats"
}

type CreateChat = {
    type: "CreateChat"
    chatId: string
}

type GetChat = {
    type: "GetChat"
    chatId: string
}

type MsgToSrv = SendMsg | StopGen | GetChats | CreateChat | GetChat

const createWs = (args: {
    onOpen: () => void
    onClose: () => void
    onMsg: (msg: MsgFromSrv) => void
}) => {
    let ws

    const createConn = () => {
        ws = new WebSocket("ws://localhost:5566/ws")

        ws.onopen = () => {
            console.log("onopen")
            args.onOpen()
        }
    
        ws.onclose = () => {
            args.onClose()
            setTimeout(createConn, 1000)
        }
    }

    createConn()

    ws.onmessage = data => {
        const msg = JSON.parse(data.data)
        args.onMsg(msg)
    }

    return {
        sendMsg: (msg: MsgToSrv) => {
            let text = JSON.stringify(msg)
            ws.send(text)
        }
    }
}

const updateQueryParam = (param: string, value: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set(param, value)
    window.history.replaceState({}, "", url.toString())
}

const clearQueryParam = (param: string) => {
    const url = new URL(window.location.href)
    url.searchParams.delete(param)
    window.history.replaceState({}, "", url.toString())
}

const getQueryParam = (param: string) => {
    const url = new URL(window.location.href)
    return url.searchParams.get(param)
}

class OtherChats {
    private root: HTMLDivElement
    private onChatClicked: (chatId: string) => void
    
    constructor(args: {
        root: HTMLDivElement
        onChatClicked: (chatId: string) => void
    }) {
        this.root = args.root
        this.onChatClicked = args.onChatClicked
    }

    public addPlaceholder(chatId: string) {
        console.log("addPlaceholder")

        let id = "chat_" + chatId

        if (document.getElementById(id)) {
            console.log("already exists")
            return
        }

        const div = document.createElement("div")
        div.id = id
        div.innerHTML = chatId
        div.style.marginTop = "10px"
        div.style.marginBottom = "10px"
        div.style.cursor = "pointer"
        div.style.color = "blue"

        div.onclick = () => {
            this.onChatClicked(chatId)
        }

        this.root.appendChild(div)
    }
}

const formatMsgText = (text: string) => {
    return text.replace(/\n/g, "<br>").replace(/ /g, "&nbsp;")
}

class ChatMessages {
    private root: HTMLDivElement
    
    constructor(args: {
        root: HTMLDivElement
    }) {
        this.root = args.root
    }

    public setChat(chat: Chat) {
        this.root.innerHTML = ""

        for (const msg of chat.messages) {
            this.addMessage(msg)
        }
    }

    public addMessage(msg: ChatMsg) {
        const div = document.createElement("div")
        div.id = msg.id
        div.style.marginLeft = "5px"
        div.style.marginRight = "5px"
        div.style.marginTop = "10px"
        div.style.marginBottom = "10px"
    
        const headerDiv = document.createElement("div")
        headerDiv.innerHTML = msg.user
        headerDiv.style.fontSize = "20px"
        headerDiv.style.fontWeight = "2px"
    
        const bodyDiv = document.createElement("div")
        bodyDiv.innerHTML = formatMsgText(msg.message)
        bodyDiv.className = "msgText"
    
        div.appendChild(headerDiv)
        div.appendChild(bodyDiv)

        this.root.appendChild(div)
    }

    public add_delta(msgDelta: MsgDelta) {
        const existingChatMessage = document.getElementById(msgDelta.msgId)

        if (existingChatMessage) {
            const textComponent = existingChatMessage.children[1]

            textComponent.innerHTML += formatMsgText(msgDelta.delta)

            return
        }

        console.log("create new chatMsg", msgDelta)

        this.addMessage({
            id: msgDelta.msgId,
            user: msgDelta.author,
            bot: true,
            message: msgDelta.delta,
            datetime: new Date().toISOString()
        })
    }

    public clear() {
        this.root.innerHTML = ""
    }
}

enum Model {
    gpt4 = "gpt4",
    gpt3_5 = "gpt3.5",
    random = "random"
}

window.onload = () => {
    let currentChatId = null

    const connectionStatus = document.getElementById("connectionStatus")
    const instructionTextrea = document.getElementById("instructionText") as HTMLTextAreaElement

    const modelSelect = document.querySelector("#modelSelect") as HTMLSelectElement
    let currentModel =  Model.random
    modelSelect.value = currentModel

    modelSelect.onchange = e => {
        currentModel = e.target.value
        console.log("currentMode", currentModel)
    }

    const otherChats = new OtherChats({
        root: document.getElementById("otherChats") as HTMLDivElement,
        onChatClicked: chatId => {
            currentChatId = chatId
            console.log("currentChatId", currentChatId)

            ws.sendMsg({
                type: "GetChat",
                chatId
            })

            updateQueryParam("chatId", chatId)
        }
    })

    // const messagesBox = document.querySelector("#messagesBox")

    const messages = new ChatMessages({
        root: document.getElementById("messagesBox") as HTMLDivElement
    })

    const newChatBtn = document.getElementById("newChatButton")
    newChatBtn.onclick = () => {
        currentChatId = ""
        messages.clear()
        clearQueryParam("chatId")
    }

    let ws = createWs({
        onOpen: () => {
            connectionStatus.innerHTML = "Connected"
            connectionStatus.style.color = "green"

            ws.sendMsg({
                type: "GetChats"
            })
        },
        onClose: () => {
            connectionStatus.innerHTML = "Not connected"
            connectionStatus.style.color = "red"
        },
        onMsg: msg => {
            if (msg.type === "MsgDelta") {
                messages.add_delta(msg)
            }

            if (msg.type === "ChatIds") {
                for (const chatId of msg.ids) {
                    otherChats.addPlaceholder(chatId)
                }

                const chatId = getQueryParam("chatId")

                if (chatId) {
                    currentChatId = chatId
                    ws.sendMsg({
                        type: "GetChat",
                        chatId
                    })
                }
            }

            if (msg.type === "Chat") {
                console.log("chat", msg)
                otherChats.addPlaceholder(msg.id)
                messages.setChat(msg)
                currentChatId = msg.id
                updateQueryParam("chatId", msg.id)
            }
        }
    })

    const body = document.querySelector("body")

    console.log(body)

    const newMessageInput = document.getElementById("newMessageInput") as HTMLInputElement
    const sendButton = document.querySelector("#sendButton") as HTMLButtonElement
    
    const sendMessageAction = () => {
        const msg = newMessageInput.value
        console.log("send message ", msg)

        const msgClientId = v4()

        messages.addMessage({
            id: msgClientId,
            user: "User",
            bot: false,
            message: msg,
            datetime: new Date().toISOString()
        })

        console.log("instructions", instructionTextrea.value)

        ws.sendMsg({
            type: "SendMsg",
            chatId: currentChatId,
            msgCliId: msgClientId,
            model: currentModel,
            txt: msg,
            instructions: instructionTextrea.value
        })

        newMessageInput.value = ""
    }


    sendButton.onclick = () => sendMessageAction()

    
    newMessageInput.onkeydown = e => {
        if (e.key === "Enter") {
            sendMessageAction()
        }
    }
}