export type Model = typeof models[number]

export const models = [
	"openai/gpt-4o",
	"openai/gpt-4o-mini",
	"openai/chatgpt-4o-latest",
	"openai/o3-mini",
    "groq/mixtral-8x7b-32768",
	"groq/llama3-70b-8192",
	"groq/llama3-8b-8192",
    "groq/gemma-7b-it",
	"together/deepseek-ai/DeepSeek-R1",
	"anthropic/claude-3-5-sonnet-latest",
	"anthropic/claude-2.1"
] as const

export type ModelKey = typeof models[number]

export type ModelSettings = {
	// Cost per million tokens for input
	inputTokenCost?: number
	// Cost per million tokens for output
	outputTokenCost?: number
	contextSize?: number
	// If this is not set it will try to minimize the context size
	// by limiting number of messages in the context.
	noContextLimiting?: boolean
}

export const modelSetings: Partial<Record<Model, ModelSettings>> = {
	"openai/gpt-4o": {
		inputTokenCost: 2.50,
		outputTokenCost: 10.00,
		contextSize: 128_000
	},
	"openai/gpt-4o-mini": {
		inputTokenCost: 0.150,
		outputTokenCost: 0.600,
		contextSize: 128_000,
		noContextLimiting: true
	},
	"openai/chatgpt-4o-latest": {
		inputTokenCost: 5.00,
		outputTokenCost: 15.00,
		contextSize: 128_000
	},
	"groq/mixtral-8x7b-32768": {
		contextSize: 32768
	},
	"groq/llama3-70b-8192": {
		contextSize: 8192
	},
	"groq/llama3-8b-8192": {
		contextSize: 8192
	},
	"anthropic/claude-3-5-sonnet-latest": {
		contextSize: 200000,
		inputTokenCost: 3.00,
		outputTokenCost: 15.00
	},
}