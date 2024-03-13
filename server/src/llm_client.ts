import Groq from "groq-sdk";
import { Model } from "../../types";
import { LLmMessage } from "./types";
import openai, { OpenAI } from "openai"
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

const anyscale = lazy(() => {
    const apiKey = process.env.ANYSCALE_API_KEY

    if (!apiKey) {
        throw new Error("ANYSCALE_API_KEY is not set")
    }

    return new OpenAI({ 
        baseURL: "https://api.endpoints.anyscale.com/v1",
        apiKey 
    })
})

export type LLMStreamEvent = {
    type: "delta"
    delta: string
} | {
    type: "done"
}

async function* wrapOpenAIStream(stream: AsyncIterable<openai.Chat.Completions.ChatCompletionChunk>): AsyncIterable<LLMStreamEvent> {
    for await (const chunk of stream) {
        const choice = chunk.choices[0]

        if (!choice) {
            continue
        }

        if (choice.finish_reason) {
            break
        }

        const content = choice.delta?.content

        if (!content) {
            continue
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

        if (args.model.startsWith("anyscale/")) {
            const model = args.model.replace("anyscale/", "")
            const stream = await anyscale().chat.completions.create({
                model,
                messages: args.messages,
                stream: true,
                temperature: 0.1
            })

            return wrapOpenAIStream(stream)
        }

        throw new Error(`Unknown model: ${args.model}`)
    }
}