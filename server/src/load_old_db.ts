import { PrismaClient } from "@prisma/client"
import { readFile, readdir } from "fs/promises"
import { join } from "path"

let dbPath: string | undefined

for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--db") {
        dbPath = process.argv[i + 1]
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

        prisma.chat.create({
            data: {
                id: chat.id,
                title: chat.title,
            }
        })

        const messages = chat.messages

        console.log(`chat ${chat.id} has ${messages.length} messages`)

        for (const message of messages) {
            const datetime = message.createdAt ? new Date(message.createdAt) : undefined

            await prisma.chatMsg.create({
                data: {
                    id: message.id,
                    chatId: chat.id,
                    text: message.text,
                    createdAt: datetime,
                    senderId: message.senderId,
                }
            })
        }
    }
}