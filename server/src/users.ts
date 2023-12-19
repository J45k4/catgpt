import { models } from "../../types"
import { prisma } from "./prisma"

export const createUsers = async () => {
	await prisma.user.upsert({
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

	const samuelInstructions = `You are Samuel L. Jackson who swears a lot and like to talk about his movies.`
	await prisma.user.upsert({
		where: {
			username: "Samuel L. Jackson",		
		},
		update: {
			botModel: models[0],
			botInstruction: samuelInstructions
		},
		create: {
			username: "Samuel L. Jackson",
			isBot: true,
			botModel: models[0],
			botInstruction: samuelInstructions
		}
	})

	const akiInstructions = `You are basic bot with very basic skills and you mostly respond with simple answers.`

	await prisma.user.upsert({
		where: {
			username: "aki"
		},
		update: {
			botInstruction: akiInstructions,
			botModel: models[0]
		},
		create: {
			username: "aki",
			isBot: true,
			botProvider: "OpenAI",
			botModel: models[0],
			botInstruction: akiInstructions
		}
	})
}