export type MsgDelta = {
    type: "MsgDelta"
    chatId: string
    msgId: string
    delta: string
}

export type StartWriting = {
    type: string
}

export type FinishWrite = {
    type: string
}

export type ChatMsg = {
    id: string,
    chatId: string
    message: string,
    user: string,
    datetime: string,
    bot: boolean
}

export type Chat = {
    type: "Chat"
    id: string
    title: String
    messages: ChatMsg[]
}

export type Chats = {
    type: "Chats"
    chats: Chat[]
}

export type ChatIds = {
    type: "ChatIds"
    ids: string[]
}

export type Personalities = {
    type: "Personalities"
    personalities: Personality[]
}

export type Personality = {
    type: "Personality"
    id: string
    txt: string
}

export type NewPersonality = {
    type: "NewPersonality"
    personality: Personality
}

export type PersonalityDeleted = {
    type: "PersonalityDeleted"
    id: string
}

export type NewMsg = {
    type: "NewMsg",
    msg: ChatMsg
}

export type ChatCreated = {
    type: "ChatCreated"
    chat: Chat
}

export type NewChat = {
    type: "NewChat"
    chat: Chat
}

export type MsgDeleted = {
    type: "MsgDeleted"
    chatId: string
    msgId: string
}

export type Authenticated = {
    type: "Authenticated"
    token: string
}

export type MsgFromSrv = MsgDelta | 
    Chats | 
    ChatIds | 
    Chat | 
    Personalities | 
    NewPersonality |
    PersonalityDeleted |
    NewMsg |
    ChatCreated |
    NewChat |
    MsgDeleted |
    Authenticated

export type SendMsg = {
    type: "SendMsg"
    chatId: string
    // msgCliId: string
    txt: string
    model: string
    instructions?: string
}

export type StopGen = {
    type: "StopGen"
}

export type GetChats = {
    type: "GetChats"
}

export type CreateChat = {
    type: "CreateChat"
    chatId: string
}

export type GetChat = {
    type: "GetChat"
    chatId: string
}

export type SavePeronality = {
    type: "SavePersonality"
    txt: string
    id?: string
}

export type GetPersonalities = {
    type: "GetPersonalities"
}

export type DelPersonality = {
    type: "DelPersonality"
    id: string
}

export type DelMsg = {
    type: "DelMsg"
    chatId: string
    msgId: string
}

export type Login = {
    type: "Login"
    username: string
    password: string
}

export type Authenticate = {
    type: "Authenticate"
    token: string
}

export type MsgToSrv = SendMsg | 
    StopGen | 
    GetChats | 
    CreateChat | 
    GetChat |
    SavePeronality |
    GetPersonalities |
    DelPersonality |
    DelMsg |
    Login |
    Authenticate