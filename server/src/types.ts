
type Delta = {
    type: "Delta"
    chatId: number
    msgId: number
    delta: string
}

export type LLmEvent = Delta
export type LLmMessageRole = "assistant" | "user" | "system"
export type LLmMessage = {
    type: LLmMessageRole
    text: string
}