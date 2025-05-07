import Groq from "groq-sdk";
import Anthropic from '@anthropic-ai/sdk';
import { LLmMessage } from "./types";
import openai, { OpenAI } from "openai"
import { lazy } from "./utility";
import { anthropicApiKey } from "./config";
import { Model } from "../../models";

const openAiClient = lazy(() => {
	const apiKey = process.env.OPENAI_API_KEY

	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is not set")
	}

	return new openai.OpenAI({ apiKey })
})

const xaiClient = lazy(() => {
	const apiKey = process.env.XAI_API_KEY
	if (!apiKey) throw new Error("XAI_API_KEY is not set")
	const client = new OpenAI({
		apiKey,
		baseURL: "https://api.x.ai/v1",
	})
	return client
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

const together = lazy(() => {
	const apiKey = process.env.TOGETHER_API_KEY
	if (!apiKey) throw new Error("TOGETHER_API_KEY is not set")
	return new OpenAI({
		baseURL: "https://api.together.xyz/v1",
		apiKey
	})
})

const anthropic = lazy(() => {
	if (!anthropicApiKey) {
		throw new Error("ANTHROPIC_API_KEY is not set")
	}

	return new Anthropic({ apiKey: anthropicApiKey })
})

type Context = {
	stop: boolean
}

export type LLMStreamEvent = {
	type: "delta"
	delta: string
} | {
	type: "done"
}

async function* wrapOpenAIStream(stream: AsyncIterable<openai.Chat.Completions.ChatCompletionChunk>, ctx: Context): AsyncIterable<LLMStreamEvent> {
	for await (const chunk of stream) {
		if (ctx.stop) {
			break
		}

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

async function* handleAnthropic(model: string, messages: LLmMessage[], ctx: Context): AsyncIterable<LLMStreamEvent> {
	const systemMsg = messages.find(p => p.role === "system")?.content
	const stream = await anthropic().messages.stream({
		model,
		max_tokens: 4000,
		system: systemMsg,
		messages: messages.filter(e => e.role !== "system").map(p => {
			let role: "user" | "assistant" = "user"
			if (p.role === "assistant") {
				role = "assistant"
			}

			if (p.role === "user") {
				role = "user"
			}

			if (p.role === "system") {
				throw new Error("System message should not be sent to the model")
			}

			return {
				role: role,
				content: p.content
			}
		})
	})

	for await (const event of stream) {
		if (ctx.stop) {
			break
		}

		if (event.type === "content_block_delta") {
			yield {
				type: "delta",
				delta: event.delta.text,
			}
		}
	}

	yield {
		type: "done"
	}
}

export class LLMStream {

}

export class LLMClient {
	private contexes: Map<string, Context> = new Map()

	public async streamRequest(args: {
		id: string
		model: Model
		messages: LLmMessage[]
	}): Promise<AsyncIterable<LLMStreamEvent>> {
		console.log("streamRequest", args)

		let ctx: Context = {
			stop: false
		}
		this.contexes.set(args.id, ctx)

		if (args.model.startsWith("openai/")) {
			const model = args.model.replace("openai/", "")

			const stream = await openAiClient().chat.completions.create({
				model: model,
				messages: args.messages,
				stream: true,
			})

			return wrapOpenAIStream(stream, ctx)
		}

		if (args.model.startsWith("groq/")) {
			const model = args.model.replace("groq/", "")

			const stream = await groq().chat.completions.create({
				model: model,
				messages: args.messages,
				stream: true,
			})

			return wrapOpenAIStream(stream, ctx)
		}

		if (args.model.startsWith("xai/")) {
			const model = args.model.replace("xai/", "")
			const stream = await xaiClient().chat.completions.create({
				model: model,
				messages: args.messages,
				stream: true,
			})
			return wrapOpenAIStream(stream, ctx)
		}

		if (args.model.startsWith("together/")) {
			const model = args.model.replace("together/", "")
			const stream = await together().chat.completions.create({
				model,
				messages: args.messages,
				stream: true,
				temperature: 0.1
			})
			return wrapOpenAIStream(stream, ctx)
		}

		if (args.model.startsWith("anthropic/")) {
			const model = args.model.replace("anthropic/", "")
			return handleAnthropic(model, args.messages, ctx)
		}

		throw new Error(`Unknown model: ${args.model}`)
	}

	public async stopStream(id: string) {
		const ctx = this.contexes.get(id)

		if (!ctx) {
			return
		}

		ctx.stop = true
	}
}