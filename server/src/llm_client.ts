import { PrismaClient } from "@prisma/client";
import { LLmMessage, LLmMessageRole } from "./types";
import openai from "openai"
import { encode } from "gpt-tokenizer";
import { WsBus } from "./ws_handler";

const openAiClient = new openai.OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

type Provider = "OpenAI" | "Anyscale"

export class LLMClient {
    private prisma: PrismaClient
    private wsbus: WsBus

    public constructor(args: {
        prisma: PrismaClient
        wsbus: WsBus
    }) {
        this.prisma = args.prisma
        this.wsbus = args.wsbus
    }

    public stopGeneration = () => {

    }
    
    public async streamRequest(args: {
        chatId: number
        msgId: number
        provider: Provider
        messages: LLmMessage[]
    }) {
        const tokenLimit = 2000

        const chatMsgs = await this.prisma.chatMsg.findMany({
            where: {
                chatId: args.chatId
            },
            include: {
                user: {
                    select: {
                        isBot: true
                    }
                }
            }
        })
        chatMsgs.reverse()

        const messages = []
        let totalTokenCount = 0

        for (const msg of chatMsgs) {
            const tokens = encode(msg.text)
            const tokenCount = tokens.length

            let role: LLmMessageRole = "user"

            if (msg.user.isBot) {
                role = "assistant"
            }

            if (totalTokenCount + tokenCount > tokenLimit) {
                break
            }

            messages.push({
                role,
                content: msg.text
            })

            totalTokenCount += tokenCount
        }
        
        messages.reverse()

        if (args.provider === "OpenAI") {
            const stream = await openAiClient.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages,
                stream: true,
            })

            let text = ""

            for await (const chunk of stream) {
                const choice = chunk.choices[0]
                text += choice.delta.content

                const content = choice.delta.content

                if (!content) {
                    continue
                }

                this.wsbus.sendMsg({
                    type: "MsgDelta",
                    chatId: args.chatId + "",
                    msgId: args.msgId + "",
                    delta: content
                })
            }

            const tokens = encode(text)

            await this.prisma.chatMsg.update({
                where: {
                    id: args.msgId
                },
                data: {
                    text,
                    tokenCount: tokens.length
                }
            })

            const chat = await this.prisma.chat.findUnique({
                where: {
                    id: args.chatId
                }
            })

            if (!chat?.title) {
                messages.push({
                    role: "user" as const,
                    content: "summarise this conversation with very short sentence. Be very brief it is important!!"
                })
    
                const titleStream = await openAiClient.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages,
                    stream: true,
                })
    
                let title = ""
    
                for await (const chunk of titleStream) {
                    const choice = chunk.choices[0]
                    const content = choice.delta.content
    
                    if (!content) {
                        continue
                    }
    
                    title += content
    
                    this.wsbus.sendMsg({
                        type: "TitleDelta",
                        chatId: args.chatId + "",
                        delta: content
                    })
                }
    
                await this.prisma.chat.update({
                    where: {
                        id: args.chatId
                    },
                    data: {
                        title
                    }
                })
            }
        }
    }

    public async genTitle(args: {
        chatId: number
    }) {
        const tokenLimit = 2000

        const chatMsgs = await this.prisma.chatMsg.findMany({
            where: {
                chatId: args.chatId
            },
            include: {
                user: {
                    select: {
                        isBot: true
                    }
                }
            }
        })
        chatMsgs.reverse()

        const messages = []
        let totalTokenCount = 0

        for (const msg of chatMsgs) {
            const tokens = encode(msg.text)
            const tokenCount = tokens.length

            let role: LLmMessageRole = "user"

            if (msg.user.isBot) {
                role = "assistant"
            }

            if (totalTokenCount + tokenCount > tokenLimit) {
                break
            }

            messages.push({
                role,
                content: msg.text
            })

            totalTokenCount += tokenCount
        }
        
        messages.reverse()

        messages.push({
            role: "user" as const,
            content: "summarise this conversation with very short sentence. Be very brief it is important!!"
        })

        const titleStream = await openAiClient.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            stream: true,
        })

        let title = ""

        for await (const chunk of titleStream) {
            const choice = chunk.choices[0]
            const content = choice.delta.content

            if (!content) {
                continue
            }

            title += content

            this.wsbus.sendMsg({
                type: "TitleDelta",
                chatId: args.chatId + "",
                delta: content
            })
        }

        await this.prisma.chat.update({
            where: {
                id: args.chatId
            },
            data: {
                title
            }
        })
    }

    public sendRequest(args: {
            
    }) {
    
    }
}