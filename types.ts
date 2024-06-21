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
	msgId: string
}

export type GenerationFinished = {
	type: "GenerationFinished"
	msgId: string
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
	msgId: string
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

export type Model = typeof models[number]

export const models = [
    "openai/gpt-3.5-turbo", 
	"openai/gpt-4-turbo",
    "openai/gpt-4-1106-preview", 
    "openai/gpt-4-vision-preview",
	"openai/gpt-4o", 
    "groq/mixtral-8x7b-32768",
    "groq/llama2-70b-4096",
	"groq/llama3-70b-8192",
	"groq/llama3-8b-8192",
    "groq/gemma-7b-it",
    "anyscale/mistralai/Mixtral-8x7B-Instruct-v0.1",
    "anyscale/mistralai/Mistral-7B-Instruct-v0.1",
	"anyscale/meta-llama/Llama-3-8b-chat-hf",
    "anyscale/meta-llama/Llama-3-70b-chat-hf",
	"anthropic/claude-3-haiku-20240307",
	"anthropic/claude-3-sonnet-20240229",
	"anthropic/claude-3-5-sonnet-20240620",
	"anthropic/claude-3-opus-20240229",
	"anthropic/claude-2.1"
] as const

export type ModelKey = typeof models[number]

export type ModelSettings = {
	// Cost per million tokens for input
	inputTokenCost?: number
	// Cost per million tokens for output
	outputTokenCost?: number
	contextSize?: number
}

export const modelSetings: Partial<Record<Model, ModelSettings>> = {
	"openai/gpt-3.5-turbo": {
		inputTokenCost: 0.50,
		outputTokenCost: 1.50,
		contextSize: 16385
	},
	"openai/gpt-4-turbo": {
		inputTokenCost: 10.00,
		outputTokenCost: 30.00,
		contextSize: 128_000
	},
	"openai/gpt-4o": {
		inputTokenCost: 5.00,
		outputTokenCost: 15.00,
		contextSize: 128_000
	},
	"groq/mixtral-8x7b-32768": {
		contextSize: 32768
	},
	"groq/llama2-70b-4096": {
		contextSize: 4096
	},
	"groq/llama3-70b-8192": {
		contextSize: 8192
	},
	"groq/llama3-8b-8192": {
		contextSize: 8192
	},
	"anthropic/claude-3-haiku-20240307": {
		contextSize: 200000,
		inputTokenCost: 0.25,
		outputTokenCost: 1.25
	},
	"anthropic/claude-3-sonnet-20240229": {
		contextSize: 200000,
		inputTokenCost: 3.00,
		outputTokenCost: 15.00
	},
	"anthropic/claude-3-5-sonnet-20240620": {
		contextSize: 200000,
		inputTokenCost: 3.00,
		outputTokenCost: 15.00
	},
	"anthropic/claude-3-opus-20240229": {
		contextSize: 200000,
		inputTokenCost: 15.00,
		outputTokenCost: 75.00
	},
}