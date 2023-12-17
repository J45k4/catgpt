import { User } from "@prisma/client"
import { t } from "elysia"

type Delta = {
    type: "Delta"
    chatId: number
    msgId: number
    delta: string
}

export type LLMEvent = Delta
export type LLMMessageRole = "assistant" | "user" | "system"
export type LLmMessage = {
    role: LLMMessageRole
    content: string
}

export type Provider = "OpenAI" | "Anyscale"
export type Model = "gpt-3.5-turbo" | "gpt-4-1106-preview" | "gpt-4-vision-preview"
export const toModel = (m: Model) => m

export const SendMsg = t.Object({
    type: t.Literal("SendMsg"),
    chatId: t.Optional(t.String()),
    txt: t.String()
})

export type State = {
    socketId: number
    user?: User
}