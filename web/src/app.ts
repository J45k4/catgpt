import { v4 } from "uuid"

type MsgDelta = {
    type: "MsgDelta"
    msgId: string
    delta: string
    index:  number
    author: string
}

type StartWriting = {
    type: String
}

type FinishWrite = {
    type: String
}

type MsgFromSrv = MsgDelta

type SendMsg = {
    type: "SendMsg"
    chatId: number
    msgCliId: string
    txt: string
    model: string
    instructions?: string
}

type StopGen = {
    type: "StopGen"
}

type MsgToSrv = SendMsg | StopGen

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

enum Model {
    gpt4 = "gpt4",
    gpt3_5 = "gpt3.5",
    random = "random"
}

window.onload = () => {
    const connectionStatus = document.getElementById("connectionStatus")
    const instructionTextrea = document.getElementById("instructionText") as HTMLTextAreaElement

    const modelSelect = document.querySelector("#modelSelect") as HTMLSelectElement
    let currentModel =  Model.random
    modelSelect.value = currentModel

    modelSelect.onchange = e => {
        currentModel = e.target.value
        console.log("currentMode", currentModel)
    }


    const messagesBox = document.querySelector("#messagesBox")

    let ws = createWs({
        onOpen: () => {
            connectionStatus.innerHTML = "Connected"
            connectionStatus.style.color = "green"
        },
        onClose: () => {
            connectionStatus.innerHTML = "Not connected"
            connectionStatus.style.color = "red"
        },
        onMsg: msg => {
            if (msg.type = "MsgDelta") {
                updateChatMessage({
                    container: messagesBox,
                    author: msg.author,
                    id: msg.msgId,
                    msg: msg.delta
                })
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

        ws.sendMsg({
            type: "SendMsg",
            chatId: 1,
            msgCliId: msgClientId,
            model: currentModel,
            txt: msg,
            instructions: instructionTextrea.value
        })

        newMessageInput.value = ""
        // messagesBox.innerHTML = ""
    }

}