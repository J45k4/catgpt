export type Model = typeof models[number]

export const models = [
    "openai/gpt-3.5-turbo", 
	"openai/gpt-4-turbo",
    "openai/gpt-4-1106-preview", 
    "openai/gpt-4-vision-preview",
	"openai/gpt-4o",
	"openai/gpt-4o-mini",
	"openai/gpt-4o-2024-08-06",
	"openai/chatgpt-4o-latest",
    "groq/mixtral-8x7b-32768",
	"groq/llama3-70b-8192",
	"groq/llama3-8b-8192",
    "groq/gemma-7b-it",
    "anyscale/mistralai/Mixtral-8x7B-Instruct-v0.1",
    "anyscale/mistralai/Mistral-7B-Instruct-v0.1",
	"anyscale/meta-llama/Llama-3-8b-chat-hf",
    "anyscale/meta-llama/Llama-3-70b-chat-hf",
	"anthropic/claude-3-haiku-20240307",
	"anthropic/claude-3-sonnet-20240229",
	"anthropic/claude-3-5-sonnet-20240620",
	"anthropic/claude-3-opus-20240229",
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
	"openai/gpt-3.5-turbo": {
		inputTokenCost: 0.50,
		outputTokenCost: 1.50,
		contextSize: 16385
	},
	"openai/gpt-4-turbo": {
		inputTokenCost: 10.00,
		outputTokenCost: 30.00,
		contextSize: 128_000
	},
	"openai/gpt-4o": {
		inputTokenCost: 5.00,
		outputTokenCost: 15.00,
		contextSize: 128_000
	},
	"openai/gpt-4o-mini": {
		inputTokenCost: 0.150,
		outputTokenCost: 0.600,
		contextSize: 128_000,
		noContextLimiting: true
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
	"anthropic/claude-3-haiku-20240307": {
		contextSize: 200000,
		inputTokenCost: 0.25,
		outputTokenCost: 1.25
	},
	"anthropic/claude-3-sonnet-20240229": {
		contextSize: 200000,
		inputTokenCost: 3.00,
		outputTokenCost: 15.00
	},
	"anthropic/claude-3-5-sonnet-20240620": {
		contextSize: 200000,
		inputTokenCost: 3.00,
		outputTokenCost: 15.00
	},
	"anthropic/claude-3-opus-20240229": {
		contextSize: 200000,
		inputTokenCost: 15.00,
		outputTokenCost: 75.00
	},
}