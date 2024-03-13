import Groq from "groq-sdk";
import { Model } from "../../types";
import { LLmMessage } from "./types";
import openai from "openai"
import { lazy } from "./utility";


const openAiClient = lazy(() => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set")
    }

    return new openai.OpenAI({ apiKey })
})

const groq = lazy(() => {
    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
        throw new Error("GROQ_API_KEY is not set")
    }

    return new Groq({ apiKey })
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
        model: Model
        messages: LLmMessage[]
    }): Promise<AsyncIterable<LLMStreamEvent>> => {
        console.log("streamRequest", args)

        if (args.model.startsWith("openai/")) {
            const model = args.model.replace("openai/", "")

            const stream = await openAiClient().chat.completions.create({
                model: model,
                messages: args.messages,
                stream: true,
            })

            return wrapOpenAIStream(stream)
        }

        if (args.model.startsWith("groq/")) {
            const model = args.model.replace("groq/", "")

            const stream = await groq().chat.completions.create({
                model: model,
                messages: args.messages,
                stream: true,
            })

            return wrapOpenAIStream(stream)
        }

        throw new Error(`Unknown model: ${args.model}`)
    }
}