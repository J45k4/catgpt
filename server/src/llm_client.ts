import { PrismaClient } from "@prisma/client";
import { LLmEvent, LLmMessage } from "./types";
import openai from "openai"

const openAiClient = new openai.OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

type Provider = "OpenAI" | "Anyscale"

export class LLMClient {
    private prisma: PrismaClient
    private onEvent: (event: LLmEvent) => void

    public constructor(args: {
        prisma: PrismaClient
        onEvent: (event: LLmEvent) => void
    }) {
        this.prisma = args.prisma
        this.onEvent = args.onEvent
    }

    public stopGeneration = () => {

    }
    
    public async streamRequest(args: {
        chatId: number
        msgId: number
        provider: Provider
        messages: LLmMessage[]
    }) {
        if (args.provider === "OpenAI") {
            const stream = await openAiClient.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: args.messages.map((msg) => ({
                    content: msg.text,
                    role: msg.type,
                })),
                stream: true,
            })

            let text = ""

            for await (const chunk of stream) {
                const choice = chunk.choices[0]
                console.log("delta", choice.delta)
                text += choice.delta.content

                this.onEvent({
                    type: "Delta",
                    chatId: args.chatId,
                    msgId: args.msgId,
                    delta: choice.delta.content as string
                })
            }

            await this.prisma.chatMsg.update({
                where: {
                    id: args.msgId
                },
                data: {
                    text
                }
            })
        }
    }

    public sendRequest(args: {
            
    }) {
    
    }
}