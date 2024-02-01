import { PrismaClient } from "@prisma/client"
import { readFile, readdir } from "fs/promises"
import { join } from "path"

let dbPath: string | undefined

const userMap: any = {}

for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--db") {
        dbPath = process.argv[i + 1]
    }

    if (process.argv[i] === "--usermap") {
        const val = process.argv[i + 1]
        let parts = val.split(":")
        const src = parts[0]
        const target = parseInt(parts[1])
        userMap[src] = target
    }
}

if (!dbPath) {
    console.error("Missing --db")
    process.exit(1)
}

const prisma = new PrismaClient()

const fileNames = await readdir(dbPath)

for (const fileName of fileNames) {
    const filePath = join(dbPath, fileName)
    let fileContent = await readFile(filePath)
    const fileJson = JSON.parse(fileContent.toString())
    console.log("Loading", fileName)

    const content = fileJson.content

    if (content.Chat) {
        const chat = content.Chat
        //console.log("chat", chat)

        const dbChat = await prisma.chat.create({
            data: {
                title: chat.title,
                createdAt: new Date()
            }
        })

        const messages = chat.messages as any[]

        console.log(`chat ${chat.id} has ${messages.length} messages`)

        for (const message of messages) {
            console.log("message", message)

            const datetime = message.datetime ? new Date(message.datetime) : undefined
            const userId = userMap[message.userId]
            const text = message.message

            console.log("datetime", datetime)
            console.log("userId", userId)
            console.log("text", text)

            await prisma.chatMsg.create({
                data: {
                    chatId: dbChat.id,
                    text: text,
                    timestamp: datetime,
                    userId: userId,
                    tokenCount: message.tokenCount,
                    charCount: text.length
                }
            })
        }
    }
}