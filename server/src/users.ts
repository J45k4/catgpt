import { Model, models } from "../../models"
import { prisma } from "./prisma"

export const systemUser = await prisma.user.upsert({
	where: {
		username: "System",
	},
	update: {
		isBot: false
	},
	create: {
		username: "System",
		isBot: false,
	}
})

export const createUsers = async () => {
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
			botModel: models[0],
			botInstruction: akiInstructions
		}
	})

	for (const model of models) {
		console.log("Creating bot", model)
		await prisma.user.upsert({
			where: {
				username: model
			},
			update: {
				botModel: model
			},
			create: {
				username: model,
				isBot: true,
				botModel: model
			}
		})
	}

	const users = await prisma.user.findMany(
		{
			where: {
				isBot: true,
				disabled: false
			}
		}
	)

	console.log("users", users)

	for (const user of users) {

		if (models.includes(user.botModel as Model)){
			continue
		}

		console.log(`user ${user.username} has invalid model ${user.botModel}`)
		console.log("disabling user")
		await prisma.user.update({
			where: {
				id: user.id
			},
			data: {
				disabled: true
			}
		})
	}
}