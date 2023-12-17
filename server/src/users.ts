import { prisma } from "./prisma"
import { toModel } from "./types"

export const adminUser = await prisma.user.upsert({
	where: {
		id: 1337
	},
	update: {},
	create: {
		id: 1337,
		username: "admin",
		passwordHash: "1234"
	}
})

export const akiInstructions = `You are basic bot with very basic skills and you mostly respond with simple answers.`
export const akibot = await prisma.user.upsert({
	where: {
		username: "aki"
	},
	update: {
		botInstruction: akiInstructions
	},
	create: {
		username: "aki",
		isBot: true,
		botProvider: "OpenAI",
		botModel: toModel("gpt-3.5-turbo"),
		botInstruction: akiInstructions
	}
})