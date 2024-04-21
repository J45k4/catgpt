# CatGPT

Cute personal assistant

## Environment variables

**ANTHROPIC_API_KEY** - API key for Anthropics API
**OPENAI_API_KEY** - API key for OpenAI API
**GROQ_API_KEY** - API key for Groq API
**ANYSCALE_API_KEY** - API key for Anyscale API

## Supported models

- [x] openai/gpt-3.5-turbo
- [x] openai/gpt-4-1106-preview
- [x] anyscale/Mistral-7B-Instruct-v0.1
- [x] anyscale/Mixtral-8x7B-Instruct-v0.1
- [x] anyscale/meta-llama/Llama-3-8b-chat-hf
- [x] groq/mixtra-8x7b-32768
- [x] groq/llama2-70b-4096
- [x] groq/gemma-7b-it
- [x] anthropic/claude-3-haiku-20240307
- [x] anthropic/claude-2.1

## TODO

- [ ] Add support for stopping generation
- [ ] Add support for editing previous message and resubmit it. Also possible to switch bot.
- [ ] Store current model to local storage so it can remember it.
- [ ] Implement canvas for viewing conversation history with different paths.