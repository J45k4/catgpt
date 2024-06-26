import { Model } from "./models"

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
    id?: string,
    chatId: string
    text: string,
    tokenCount?: number,
    user?: string,
    datetime: string,
    bot: boolean
}

export type Chat = {
    type: "Chat"
    id: string
    title?: string
    msgs: ChatMsg[]
}

export type Chats = {
    type: "Chats"
    chats: Chat[]
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

export type PersonalitySaved = {
    type: "PersonalitySaved"
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

export type MsgError = {
    type: "MsgError"
    chatId: string
    msgId: string
    error: string
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

export type ChatMeta = {
    type: "ChatMeta"
    id: string
    title?: string
    lastMsgDatetime: string
}

export type ChatMetas = {
    type: "ChatMetas"
    metas: ChatMeta[]
}

export type Authenticated = {
    type: "Authenticated"
    token: string
    version: string
}

export type AuthTokenInvalid = {
    type: "AuthTokenInvalid"
}

export type TitleDelta = {
    type: "TitleDelta"
    chatId: string
    delta: string
}

export type GenerationDone = {
    type: "GenerationDone"
    chatId: string
    msgId: string
    msg: string
    tokenCount: number
}

export type Bot = {
    id: string
    name: string
    model: string
    instructions?: string
}

export type Bots = {
    type: "Bots"
    bots: Bot[]
}

export type BotRes = {
    type: "Bot"
} & Bot

export type ErrorRes = {
    type: "error"
    error: {
        message: string
    }
}

export type GenerationStarted = {
	type: "GenerationStarted"
	chatId: string
}

export type GenerationFinished = {
	type: "GenerationFinished"
	chatId: string
}

export type MsgFromSrv = MsgDelta | 
    Chats |
    Chat | 
    ChatMetas |
    ChatMeta |
    Personalities | 
    PersonalitySaved |
    PersonalityDeleted |
    NewMsg |
    ChatCreated |
    NewChat |
    MsgDeleted |
    Authenticated |
    AuthTokenInvalid |
    TitleDelta |
    GenerationDone |
    Bots |
    BotRes |
    ErrorRes |
    MsgError |
	GenerationStarted |
	GenerationFinished

export type SendMsg = {
    type: "SendMsg"
    chatId?: string
    txt: string
    botId: string
}

export type StopGen = {
    type: "StopGen"
}

export type GetChats = {
    type: "GetChats"
    offset?: number
    limit?: number
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

export type GenTitle = {
    type: "GenTitle"
    chatId: string
}

export type GetProjects = {
    type: "GetProjects"
}

export type GetBots = {
    type: "GetBots"
}

export type GetBot = {
    type: "GetBot"
    id: string
}

export type CreateBot = {
    type: "CreateBot"
    name: string
    model: Model
    instructions: string
}

export type UpdateBot = {
    type: "UpdateBot"
    id: string
    name: string
    model: Model
    instructions: string
}

export type DeleteBot = {
    type: "DeleteBot"
    id: string
}

export type StopGeneration = {
	type: "StopGeneration"
	chatId: string
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
    Authenticate |
    GenTitle |
    GetProjects |
    GetBots |
    GetBot |
    CreateBot |
    UpdateBot |
    DeleteBot |
	StopGeneration
