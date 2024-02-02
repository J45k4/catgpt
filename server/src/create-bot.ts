import { prisma } from "./prisma"

let username
let provider

for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--username") {
        username = process.argv[i + 1]
    }

    if (process.argv[i] === "--provider") {
        provider = process.argv[i + 1]
    }
}

if (!username) {
    console.error("Missing --username")
    process.exit(1)
}

if (!provider) {
    console.error("Missing --provider")
    process.exit(1)
}

const existing = await prisma.user.findFirst({
    where: {
        username
    }
})

if (existing) {
    console.error(`User ${username} already exists`)
    process.exit(1)
}

console.log(`Creating user ${username} with provider ${provider}`)

await prisma.user.create({
    data: {
        username,
        isBot: true,
        createdAt: new Date()
    }
})