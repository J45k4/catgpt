import { LLmMessage, Model, Provider } from "./types";
import openai from "openai"

const openAiClient = new openai.OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export type LLMStreamEvent = {
    type: "delta"
    delta: string
} | {
    type: "done"
}

async function* wrapOpenAIStream(stream: AsyncIterable<openai.Chat.Completions.ChatCompletionChunk>): AsyncIterable<LLMStreamEvent> {
    for await (const chunk of stream) {
        const content = chunk.choices[0].delta.content

        if (content === undefined) {
            break
        }

        yield {
            type: "delta",
            delta: content as string
        }
    }

    yield {
        type: "done"
    }
}

export const llmClient = {
    streamRequest: async (args: {
        provider: Provider
        model: Model
        messages: LLmMessage[]
    }): Promise<AsyncIterable<LLMStreamEvent>> => {
        console.log("streamRequest", args)

        if (args.provider === "OpenAI") {
            const stream = await openAiClient.chat.completions.create({
                model: args.model,
                messages: args.messages,
                stream: true,
            })

            return wrapOpenAIStream(stream)
        }

        throw new Error(`Unknown provider: ${args.provider}`)
    }
}