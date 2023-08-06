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

const createChatMessage = (args: {
    id: string
    author: string
    msg: string

}) => {
    const div = document.createElement("div")
    div.id = args.id
    div.style.marginLeft = "5px"
    div.style.marginRight = "5px"
    div.style.marginTop = "10px"
    div.style.marginBottom = "10px"

    const headerDiv = document.createElement("div")
    headerDiv.innerHTML = args.author
    headerDiv.style.fontSize = "20px"
    headerDiv.style.fontWeight = "2px"

    const bodyDiv = document.createElement("div")
    bodyDiv.innerHTML = args.msg
    bodyDiv.className = "msgText"

    div.appendChild(headerDiv)
    div.appendChild(bodyDiv)

    return div
}

const updateChatMessage = (args: {
    container: Element
    id: string
    author: string
    msg: string
}) => {
    const existingChatMessage = document.getElementById(args.id)

    if (existingChatMessage) {
        const textComponent = existingChatMessage.children[1]

        textComponent.innerHTML += args.msg

        return
    }

    console.log("create new chatMsg", args)

    const el = createChatMessage({
        id: args.id,
        author: args.author,
        msg: args.msg
    })

    args.container.appendChild(el)
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

        const div = document.createElement("div")
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
        bodyDiv.innerHTML = msg.message
        bodyDiv.className = "msgText"
    
        div.appendChild(headerDiv)
        div.appendChild(bodyDiv)

        this.root.appendChild(div)
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
        }
    })

    // const messagesBox = document.querySelector("#messagesBox")

    const messages = new ChatMessages({
        root: document.getElementById("messagesBox") as HTMLDivElement
    })

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
                updateChatMessage({
                    container: messagesBox,
                    author: msg.author,
                    id: msg.msgId,
                    msg: msg.delta
                })
            }

            if (msg.type === "ChatIds") {
                for (const chatId of msg.ids) {
                    otherChats.addPlaceholder(chatId)
                }
            }

            if (msg.type === "Chat") {
                console.log("chat", msg)

                messages.setChat(msg)
            }
        }
    })

    const body = document.querySelector("body")

    console.log(body)

    const newMessageInput = document.querySelector("#newMessageInput") as HTMLInputElement
    const sendButton = document.querySelector("#sendButton") as HTMLButtonElement
    
    sendButton.onclick = () => {
        const msg = newMessageInput.value
        console.log("send message ", msg)

        const msgClientId = v4()

        const chatMsgComponent = createChatMessage({
            id: msgClientId,
            author: "User",
            msg: msg
        })
        messagesBox.appendChild(chatMsgComponent)

        console.log("instructions", instructionTextrea.value)

        if (!currentChatId) {
            currentChatId = v4()
            ws.sendMsg({
                type: "CreateChat",
                chatId: currentChatId
            })
        }

        ws.sendMsg({
            type: "SendMsg",
            chatId: currentChatId,
            msgCliId: msgClientId,
            model: currentModel,
            txt: msg,
            instructions: instructionTextrea.value
        })

        newMessageInput.value = ""
        // messagesBox.innerHTML = ""
    }

}