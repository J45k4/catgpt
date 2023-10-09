import { Chat, ChatMeta, ChatMsg, MsgDelta, MsgFromSrv, MsgToSrv, Personality } from "./types"
import { createConn, ws } from "./ws"

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

type GroupedChats = {
    today: ChatMeta[],
    yesterday: ChatMeta[],
    older: { [date: string]: ChatMeta[] }
};

class OtherChats {
    private root: HTMLDivElement
    private activateChatId: string
    private hasTitle: Map<string, boolean>
    private onChatClicked: (chatId: string) => void
    
    constructor(args: {
        root: HTMLDivElement
        onChatClicked: (chatId: string) => void
    }) {
        this.root = args.root
        this.onChatClicked = args.onChatClicked
        this.hasTitle = new Map()
    }

    public setChatMetas(metas: ChatMeta[]) {
        const groupedChats = this.sortAndGroupChats(metas);
        console.log("groupedChats", groupedChats)
        this.buildUI(groupedChats);
    }

    private buildUI(groupedChats: GroupedChats) {
        this.root.innerHTML = '';
        if (groupedChats.today.length > 0) {
            this.addGroupToUI('Today', groupedChats.today);
        }

        if (groupedChats.yesterday.length > 0) {
            this.addGroupToUI('Yesterday', groupedChats.yesterday);
        }

        Object.keys(groupedChats.older).sort().forEach(date => {
            this.addGroupToUI(date, groupedChats.older[date]);
        });
    }

    public addChat(args: {
        chatId: string
        title?: string
    }) {
        const existing = document.getElementById("chat_" + args.chatId)
        if (existing) {
            return
        }

        const div = this.createChatMetaDiv({
            id: args.chatId,
            title: args.title
        })
        this.root.prepend(div)
    }

    private addGroupToUI(title: string, metas: ChatMeta[]) {
        const groupDiv = document.createElement('div');
        groupDiv.id = "group_" + title
        groupDiv.innerHTML = `<strong>${title}</strong>`;
        this.root.appendChild(groupDiv);

        metas.forEach(meta => {
            const div = this.createChatMetaDiv(meta)
            groupDiv.appendChild(div)
        });
    }

    private createChatMetaDiv(meta: {
        id: string
        title?: string
    }) {
        let id = "chat_" + meta.id

        if (document.getElementById(id)) {
            console.log("already exists")
            return
        }

        if (meta.title) {
            this.hasTitle.set(meta.id, true)
        }

        const div = document.createElement("div")
        div.id = id
        div.innerHTML = meta.title ?? meta.id
        div.style.marginTop = "10px"
        div.style.marginBottom = "10px"
        div.style.padding = "5px"
        div.style.cursor = "pointer"
        div.style.color = "blue"
        div.style.whiteSpace = "wrap"

        div.onclick = () => {
            this.onChatClicked(meta.id)
        }

        return div
    }

    private sortAndGroupChats(metas: ChatMeta[]): GroupedChats {
        const grouped: GroupedChats = {
            today: [],
            yesterday: [],
            older: {}
        };
    
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
    
        // Sort metas by lastMsgDatetime descending (newest first)
        metas.sort((a, b) => new Date(b.lastMsgDatetime).getTime() - new Date(a.lastMsgDatetime).getTime());
    
        metas.forEach(meta => {
            const lastMsgDate = new Date(meta.lastMsgDatetime).toDateString();
    
            if (lastMsgDate === today) {
                grouped.today.push(meta);
            } else if (lastMsgDate === yesterday) {
                grouped.yesterday.push(meta);
            } else {
                if (!grouped.older[lastMsgDate]) {
                    grouped.older[lastMsgDate] = [];
                }
                grouped.older[lastMsgDate].push(meta);
            }
        });
    
        return grouped;
    }

    public addTitleDelta(chatId: string, delta: string) {
        const div = document.getElementById("chat_" + chatId)

        if (!this.hasTitle.has(chatId)) {
            this.hasTitle.set(chatId, true)
            div.innerHTML = ""
        }

        div.innerHTML += delta
    }

    public set_title(chatId: string, title: string) {
        const div = document.getElementById("chat_" + chatId)
        div.innerHTML = title   
    }

    public setActive(chatId: string) {
        console.log("set active chat", chatId)

        if (this.activateChatId) {
            this.removeActive()
        }

        this.activateChatId = chatId
        const div = document.getElementById("chat_" + chatId)
        div.style.border = "1px solid blue"
    }

    public removeActive() {
        if (this.activateChatId) {
            const div = document.getElementById("chat_" + this.activateChatId)
            div.style.border = "none"
        }
    }

    public hide() {
        this.root.style.display = "none"
    }

    public isHidden() {
        return this.root.style.display === "none"
    }

    public show() {
        this.root.style.display = "block"
    }
}

enum ParsingState {
    Normal,
    ExpectLanguage,
    CodeBlock
}

const formatMsgText = (text: string) => {
    let formattedText = ""
    let whiteSpaceSize = 0
    let backtickCount = 0
    let state = ParsingState.Normal
    let language = ""
    for (const char of text) {
        if (char === "`") {
            backtickCount += 1

            if (backtickCount === 3) {
                if (state === ParsingState.Normal) {
                    formattedText += `<div class="codeBlock"><pre style="overflow: auto;">`
                    state = ParsingState.ExpectLanguage
                }
    
                if (state === ParsingState.CodeBlock) {
                    formattedText += "</pre></div>"
                }
            }
            continue
        } else {
            backtickCount = 0
        }  

        if (char === "\n") {
            if (state === ParsingState.ExpectLanguage) {
                state = ParsingState.CodeBlock
            }

            formattedText += "<br>"
            continue
        }

        // if (char === " ") {
        //     whiteSpaceSize += 1
        //     continue
        // }

        // if (whiteSpaceSize > 1) {
        //     formattedText += `<span style="margin-left: ${whiteSpaceSize * 2}px"></span>`
        //     whiteSpaceSize = 0
        // } else if (whiteSpaceSize === 1) {
        //     formattedText += " "
        //     whiteSpaceSize = 0
        // }

        if (state === ParsingState.ExpectLanguage) {
            language += char
            continue
        }

        formattedText += char
    }
    return formattedText
}

class ChatMessages {
    private root: HTMLDivElement
    private onDeleteMessage: (msgId: string) => void

    constructor(args: {
        root: HTMLDivElement
        onDeleteMessage: (msgId: string) => void
    }) {
        this.root = args.root
        this.onDeleteMessage = args.onDeleteMessage
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
        div.style.padding = "3px"
        div.style.backgroundColor = msg.bot ? "#e6e6e6" : "white"
    
        const headerDiv = document.createElement("div")
        headerDiv.className = "msg_header"

        const msg_info_div = document.createElement("div")
        msg_info_div.className = "msg_info"
        headerDiv.appendChild(msg_info_div)
    
        const user_name_div = document.createElement("div")
        user_name_div.innerHTML = msg.user
        user_name_div.style.fontWeight = "bold"
        user_name_div.style.fontSize = "20px"
        user_name_div.style.fontWeight = "2px"
        user_name_div.style.flexGrow = "1"
        user_name_div.style.whiteSpace = "nowrap"
        msg_info_div.appendChild(user_name_div)

        const msg_stats_div = document.createElement("div")
        msg_stats_div.className = "msg_stats"
        msg_info_div.appendChild(msg_stats_div)

        const dateDiv = document.createElement("div")
        dateDiv.innerHTML = new Date(msg.datetime).toLocaleString()
        dateDiv.className = "msgHeaderItem"
        msg_stats_div.appendChild(dateDiv)

        const wordCount = document.createElement("div")
        wordCount.innerHTML = "words: " + msg.message.split(" ").length.toString()
        wordCount.className = "msgHeaderItem"
        msg_stats_div.appendChild(wordCount)

        const charCount = document.createElement("div")
        charCount.innerHTML = "chars: " + msg.message.length.toString()
        charCount.className = "msgHeaderItem"
        msg_stats_div.appendChild(charCount)

        const btn_div = document.createElement("div")
        btn_div.className = "msg_header_btn_container"
        headerDiv.appendChild(btn_div)

        const deleteBtn = document.createElement("button")
        deleteBtn.innerHTML = "Delete"
        deleteBtn.onclick = () => {
            this.onDeleteMessage(msg.id)
        }
        btn_div.appendChild(deleteBtn)

        const copy_btn = document.createElement("button")
        copy_btn.innerHTML = "Copy"
        copy_btn.onclick = () => {
            navigator.clipboard.writeText(msg.message)
        }
        btn_div.appendChild(copy_btn)

        // headerDiv.innerHTML = msg.user
        // headerDiv.style.fontSize = "20px"
        // headerDiv.style.fontWeight = "2px"
    
        const bodyDiv = document.createElement("div")
        bodyDiv.innerHTML = formatMsgText(msg.message)
        bodyDiv.className = "msgText"
    
        div.appendChild(headerDiv)
        div.appendChild(bodyDiv)

        this.root.appendChild(div)
    }

    public del_msg(msgId: string) {
        const div = document.getElementById(msgId)
        div.remove()
    }

    public add_delta(msgDelta: MsgDelta) {
        const existingChatMessage = document.getElementById(msgDelta.msgId)

        if (!existingChatMessage) {
            return
        }

        const textComponent = existingChatMessage.children[1]

        textComponent.innerHTML += formatMsgText(msgDelta.delta) 
    }

    public clear() {
        this.root.innerHTML = ""
    }
}

class PersonalitiesContainer {
    private root: HTMLDivElement
    private onPersonalityClicked: (personality: Personality) => void
    
    constructor(args: {
        root: HTMLDivElement
        onPersonalityClicked: (personality: Personality) => void
    }) {
        this.root = args.root
        this.onPersonalityClicked = args.onPersonalityClicked
    }

    public setPersonalities(personalities: Personality[]) {
        this.root.innerHTML = ""

        for (const personality of personalities) {
            this.addPersonality(personality)
        }
    }

    public addPersonality(personality: Personality) {
        const existingPersonality = document.getElementById(personality.id)

        if (existingPersonality) {
            existingPersonality.innerHTML = personality.txt
            return
        }

        const div = document.createElement("div")
        div.innerHTML = personality.txt
        div.id = personality.id
        div.style.marginTop = "10px"
        div.style.marginBottom = "10px"
        div.style.cursor = "pointer"
        div.style.color = "blue"
        div.onclick = () => {
            this.onPersonalityClicked(personality)
        }

        this.root.appendChild(div)
    }

    public deletePersonality(personalityId: string) {
        const div = document.getElementById(personalityId)
        div.remove()
    }
}

enum Model {
    gpt4 = "gpt4",
    gpt3_5 = "gpt3.5",
    random = "random"
}

window.onload = () => {
    let currentChatId = getQueryParam("chatId") || null
    let currentPersonalityId = getQueryParam("personalityId") || null
    let clientMsgId = 1

    let current_version = null

    const connectionStatus = document.getElementById("connectionStatus")
    const personalityTxt = document.getElementById("instructionText") as HTMLTextAreaElement

    const modelSelect = document.querySelector("#modelSelect") as HTMLSelectElement
    let currentModel =  Model.random
    modelSelect.value = currentModel

    modelSelect.onchange = (e: any) => {
        currentModel = e.target.value
        console.log("currentMode", currentModel)
        updateQueryParam("model", currentModel)
    }

    const model = getQueryParam("model")
    modelSelect.value = model || Model.gpt3_5
    currentModel = model as Model || Model.gpt3_5

    const gen_title_btn = document.getElementById("gen_title_btn")
    gen_title_btn.onclick = () => {
        ws.send({
            type: "GenTitle",
            chatId: currentChatId
        })
    }

    if (!currentChatId) {
        gen_title_btn.hidden = true
    }

    const otherChats = new OtherChats({
        root: document.getElementById("otherChats") as HTMLDivElement,
        onChatClicked: chatId => {
            currentChatId = chatId
            console.log("currentChatId", currentChatId)

            gen_title_btn.hidden = false

            ws.send({
                type: "GetChat",
                chatId
            })

            updateQueryParam("chatId", chatId)

            otherChats.setActive(chatId)
        }
    })

    // const messagesBox = document.querySelector("#messagesBox")

    const messages = new ChatMessages({
        root: document.getElementById("messagesBox") as HTMLDivElement,
        onDeleteMessage: msgId => {
            ws.send({
                type: "DelMsg",
                chatId: currentChatId,
                msgId
            })
        }
    })

    const newChatBtn = document.getElementById("newChatBtn")
    newChatBtn.onclick = () => {
        currentChatId = ""
        messages.clear()
        clearQueryParam("chatId")
        otherChats.removeActive()
    }

    const personalitiesContainer = new PersonalitiesContainer({
        root: document.getElementById("personalitiesContainer") as HTMLDivElement,
        onPersonalityClicked: personality => {
            console.log("personality clicked", personality)
            personalityTxt.value = personality.txt
            currentPersonalityId = personality.id
            updateQueryParam("personalityId", currentPersonalityId)
        }
    })

    ws.on_open = () => {
        connectionStatus.innerHTML = "Connected"
        connectionStatus.style.color = "green"

        ws.send({
            type: "Authenticate",
            token: localStorage.getItem("token") ?? ""
        })
    }

    ws.on_close = () => {
        connectionStatus.innerHTML = "Not connected"
        connectionStatus.style.color = "red"
    }

    ws.on_msg = msg => {
        if (msg.type === "Authenticated") {
            ws.send({
                type: "GetChats"
            })
    
            ws.send({
                type: "GetPersonalities"
            })

            if (currentChatId) {
                ws.send({
                    type: "GetChat",
                    chatId: currentChatId
                })
            }

            if (current_version != null && current_version !== msg.version) {
                window.location.reload()
            } else {
                current_version = msg.version
            }
        }

        if (msg.type === "AuthTokenInvalid") {
            localStorage.removeItem("token")
            window.location.href = "/login"
        }

        if (msg.type === "MsgDelta") {
            if (msg.chatId !== currentChatId) {
                console.debug("msgDelta for another chat")
                return
            }

            console.debug("msgDelta", msg)

            messages.add_delta(msg)
        }

        if (msg.type === "Chat") {
            console.log("chat", msg)
            otherChats.addChat({
                chatId: msg.id
            })

            if (msg.id !== currentChatId) {
                console.debug(`chat for another chat ${msg.id} !== ${currentChatId}`)
                return
            }

            messages.setChat(msg)
        }

        if (msg.type === "Personalities") {
            personalitiesContainer.setPersonalities(msg.personalities)

            if (currentPersonalityId) {
                const personality = msg.personalities.find(p => p.id === currentPersonalityId)
                if (personality) {
                    personalityTxt.value = personality.txt
                }
            }
        }

        if (msg.type === "PersonalitySaved") {
            personalitiesContainer.addPersonality(msg.personality)
            personalityTxt.value = msg.personality.txt
            currentPersonalityId = msg.personality.id
            updateQueryParam("personalityId", currentPersonalityId)
        }

        if (msg.type === "PersonalityDeleted") {
            personalitiesContainer.deletePersonality(msg.id)
        }

        if (msg.type === "NewMsg") {
            console.log("newMsg", msg)
            if (msg.msg.chatId !== currentChatId) {
                console.debug(`newMsg for another chat ${msg.msg.chatId} !== ${currentChatId}`)
                return
            }

            messages.addMessage(msg.msg)
        }

        if (msg.type === "ChatCreated") {
            console.log("chatCreated", msg)
            currentChatId = msg.chat.id
            updateQueryParam("chatId", currentChatId)
        }

        if (msg.type === "NewChat") {
            otherChats.addChat({
                chatId: msg.chat.id,
            })
        }

        if (msg.type === "MsgDeleted") {
            console.log("msgDeleted", msg)
            if (msg.chatId !== currentChatId) {
                console.debug("msgDeleted for another chat")
                return
            }

            messages.del_msg(msg.msgId)
        }

        if (msg.type === "ChatMetas") {
            otherChats.setChatMetas(msg.metas)

            if (currentChatId) {
                otherChats.setActive(currentChatId)
            }
        }

        if (msg.type === "ChatMeta") {
            otherChats.set_title(msg.id, msg.title)
        }

        if (msg.type === "TitleDelta") {
            console.log("titleDelta", msg)
            otherChats.addTitleDelta(msg.chatId, msg.delta)
        }
    }

    createConn()

    const body = document.querySelector("body")

    console.log(body)

    const newMessageInput = document.getElementById("newMessageInput") as HTMLInputElement
    newMessageInput.style.width = "100%"
    const sendButton = document.querySelector("#sendButton") as HTMLButtonElement
    
    const sendMessageAction = () => {
        const msg = newMessageInput.value
        console.log("send message ", msg)

        // messages.addMessage({
        //     id: String(clientMsgId++),
        //     chatId: currentChatId,
        //     user: "User",
        //     bot: false,
        //     message: msg,
        //     datetime: new Date().toISOString()
        // })

        console.log("instructions", personalityTxt.value)

        ws.send({
            type: "SendMsg",
            chatId: currentChatId,
            model: currentModel,
            txt: msg,
            instructions: personalityTxt.value
        })

        newMessageInput.value = ""
    }


    sendButton.onclick = () => sendMessageAction()
    
    let msg_input_heigth = 30;
    newMessageInput.style.height = msg_input_heigth + "px"
    newMessageInput.style.fontSize = "20px"
    newMessageInput.style.width = "100%"
    newMessageInput.style.resize = "none"
    newMessageInput.onkeydown = e => {
        if (e.key === "Enter") {
            if (e.shiftKey) {
                e.preventDefault()
                newMessageInput.value += "\n"
            } else {
                e.preventDefault()
                sendMessageAction()
            }
        }
        const val = newMessageInput.value

        let line_count = 0
        for (const char of val) {
            if (char === "\n") {
                line_count += 1
            }
        }

        let height = 30 + line_count * 25
        newMessageInput.style.height = height + "px"

        if (val === "") {
            sendButton.innerHTML = "Generate"
        } else {
            sendButton.innerHTML = "Send" 
        }
    }

    const savePersonalityBtn = document.getElementById("savePersonalityBtn") as HTMLButtonElement
    savePersonalityBtn.onclick = () => {
        ws.send({
            type: "SavePersonality",
            id: currentPersonalityId,
            txt: personalityTxt.value
        })
    }

    const newPersonalityBtn = document.getElementById("newPersonalityBtn") as HTMLButtonElement
    newPersonalityBtn.onclick = () => {
        personalityTxt.value = ""
    }

    const deletePersonalityBtn = document.getElementById("deletePersonalityBtn") as HTMLButtonElement
    deletePersonalityBtn.onclick = () => {
        ws.send({
            type: "DelPersonality",
            id: currentPersonalityId
        })
        personalityTxt.value = ""
    }

    const unselectPersonalityBtn = document.getElementById("unselectPersonalityBtn") as HTMLButtonElement
    unselectPersonalityBtn.onclick = () => {
        currentPersonalityId = null
        personalityTxt.value = ""
        clearQueryParam("personalityId")
    }

    // window.onresize = () => {
    //     const width = window.innerWidth
    //     if (width < 650) {
    //         if (!otherChats.isHidden()) {
    //             otherChats.hide()
    //         }
    //     } else {
    //         if (otherChats.isHidden()) {
    //             otherChats.show()
    //         }
    //     }
    // }

    // if (window.innerWidth < 650) {
    //     otherChats.hide()
    // }
}