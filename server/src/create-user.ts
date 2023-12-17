import { prisma } from "./prisma"

let username
let password

for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--username") {
        username = process.argv[i + 1]
    }

    if (process.argv[i] === "--password") {
        password = process.argv[i + 1]
    }
}

if (!username) {
    console.error("Missing --username")
    process.exit(1)
}

if (!password) {
    console.error("Missing --password")
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

const passwordHash = Bun.password.hashSync(password)

console.log(`Creating user ${username} with password hash ${passwordHash}`)

await prisma.user.create({
    data: {
        username,
        passwordHash
    }
})