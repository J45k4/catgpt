
// let ws: WebSocket

type MsgDelta = {
    type: "MsgDelta"
    delta: String
    index:  number
}

type StartWriting = {
    type: String
}

type FinishWrite = {
    type: String
}

type ServerMsg = MsgDelta

const createWs = (args: {
    onMsg: (msg) => void
}) => {
    const ws = new WebSocket("ws://localhost:5566/ws")

    ws.onopen = () => {
        console.log("onopen")
    }

    ws.onmessage = data => {
        const msg = JSON.parse(data.data)
        args.onMsg(msg)
    }

    return {
        sendMsg: (msg) => {
            let text = JSON.stringify(msg)
            ws.send(text)
        }
    }
}


window.onload = () => {
    const messagesBox = document.querySelector("#messagesBox")

    let ws = createWs({
        onMsg: msg => {
            if (msg.type = "MsgDelta") {
                messagesBox.innerHTML += msg.delta
            }
        }
    })

    const body = document.querySelector("body")

    console.log(body)

    const newMessageInput = document.querySelector("#newMessageInput") as HTMLInputElement
    const sendButton = document.querySelector("#sendButton") as HTMLButtonElement
    
    sendButton.onclick = () => {
        console.log("send message ", newMessageInput.value)

        ws.sendMsg({
            type: "SendMsg",
            room: 1,
            msg: newMessageInput.value
        })

        newMessageInput.value = ""
        messagesBox.innerHTML = ""
    }

}