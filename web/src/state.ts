import { Chat, ChatMeta } from "../../types"
import { getQueryParam } from "./utility"

type State = {
    authenticated: boolean
    chatMetas: ChatMeta[]
    selectedChatId: string | null
    currentChat: Chat | null
    version?: string
    errorMsg?: string
}

export const state: State = {
    authenticated: false,
    chatMetas: [],
    selectedChatId: getQueryParam("chatId"),
    currentChat: null,
    version: undefined,
    errorMsg: undefined
}