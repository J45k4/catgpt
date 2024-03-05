import { encode } from "gpt-tokenizer";
import { LLMMessageRole, LLmMessage, State } from "./types";
import { Model, MsgFromSrv, MsgToSrv, SendMsg } from "../../types";
import { prisma } from "./prisma";
import { SignJWT, jwtVerify } from "jose";
import { JWT_SECRET_KEY, catgptVersion } from "./config";
import { llmClient } from "./llm_client";

type Ws = {
    state: State
    send: (msg: MsgFromSrv) => void
}

const alg = "HS256"

const handleSendMsg = async (ws: Ws, msg: SendMsg) => {
    if (!ws.state.user) {
        console.error("user not authenticated")
        return;
    }

    let chat = msg.chatId ?
        await prisma.chat.findFirst({
            where: {
                id: parseInt(msg.chatId)
            },
            include: {
                messages: {
                    include: {
                        user: true
                    }
                }
            }
        }) : undefined

    if (!chat) {
        chat = await prisma.chat.create({
            data: {},
            include: {
                messages: {
                    include: {
                        user: true
                    }
                }
            }
        })

        ws.send({
            type: "ChatCreated",
            chat: {
                id: chat.id.toString(),
                type: "Chat",
                messages: []
            }
        })

        ws.send({
            type: "NewChat",
            chat: {
                id: chat.id.toString(),
                type: "Chat",
                messages: []
            }
        })
    }

    const chatMsgs = chat.messages

    const bot = await prisma.user.findFirst({
        where: {
            isBot: true,
            id: parseInt(msg.botId)
        }
    })

    if (!bot) {
        console.error("bot not found")
        return;
    }

    if (!bot.botModel) {
        console.error("bot.botModel is undefined")
        return;
    }

    const tokens = encode(msg.txt)

    const chatMsg = await prisma.chatMsg.create({
        data: {
            text: msg.txt,
            timestamp: new Date(),
            chatId: chat.id,
            userId: ws.state.user.id,
            tokenCount: tokens.length
        },
        include: {
            user: true
        }
    })
    chatMsgs.push(chatMsg)
    chatMsgs.reverse()

    ws.send({
        type: "NewMsg",
        msg: {
            id: chatMsg.id.toString(),
            chatId: chat.id.toString(),
            text: chatMsg.text,
            tokenCount: chatMsg.tokenCount,
            user: ws.state.user.username,
            datetime: chatMsg.timestamp.toISOString(),
            bot: false
        }
    })

    const botMsg = await prisma.chatMsg.create({
        data: {
            text: "",
            timestamp: new Date(),
            chatId: chat.id,
            userId: bot.id
        },
    })

    ws.send({
        type: "NewMsg",
        msg: {
            id: botMsg.id.toString(),
            chatId: chat.id.toString(),
            text: botMsg.text,
            tokenCount: botMsg.tokenCount,
            user: bot.username,
            datetime: botMsg.timestamp.toISOString(),
            bot: true
        }
    })

    const messages: LLmMessage[] = []
    let totalTokenCount = 0

    for (const msg of chatMsgs) {
        const tokens = encode(msg.text)
        const tokenCount = tokens.length

        let role: LLMMessageRole = "user"

        if (msg.user.isBot) {
            role = "assistant"
        }

        if (totalTokenCount + tokenCount > 2_000) {
            break
        }

        messages.push({
            role,
            content: msg.text
        })

        totalTokenCount += tokenCount
    }

    messages.push({
        role: "system",
        content: bot.botInstruction || ""
    })
    messages.reverse()

    try {
        const stream = await llmClient.streamRequest({
            model: bot.botModel as Model,
            messages
        })


        let text = ""

        for await (const event of stream) {
            if (event.type === "done") {
                console.log("done")

                break;
            }

            if (event.type === "delta") {
                text += event.delta

                ws.send({
                    type: "MsgDelta",
                    chatId: chat.id.toString(),
                    msgId: botMsg.id.toString(),
                    delta: event.delta
                })
            }
        }

        const botMsgTokens = encode(text)

        const updatedChatMsg = await prisma.chatMsg.update({
            where: {
                id: botMsg.id
            },
            data: {
                text,
                tokenCount: botMsgTokens.length,
                charCount: text.length
            }
        })

        ws.send({
            type: "NewMsg",
            msg: {
                id: updatedChatMsg.id.toString(),
                bot: true,
                chatId: chat.id.toString(),
                datetime: updatedChatMsg.timestamp.toISOString(),
                text: updatedChatMsg.text,
                tokenCount: updatedChatMsg.tokenCount,
                user: bot.username
            }
        })
    } catch (err: any) {
        console.log(err)

        ws.send({
            type: "MsgDelta",
            chatId: chat.id.toString(),
            msgId: botMsg.id.toString(),
            delta: "Sorry, I am not available at the moment. Please try again later."
        })
    }

    if (!chat.title) {
        messages.push({
            role: "user" as const,
            content: "summarise this conversation with very short sentence. Be very brief it is important!!"
        })

        messages.shift()

        const titleStream = await llmClient.streamRequest({
            model: "openai/gpt-3.5-turbo",
            messages
        })

        let title = ""

        for await (const event of titleStream) {
            if (event.type === "done") {
                break;
            }

            if (event.type === "delta") {
                title += event.delta

                ws.send({
                    type: "TitleDelta",
                    chatId: chat.id.toString(),
                    delta: event.delta
                })
            }
        }

        await prisma.chat.update({
            where: {
                id: chat.id
            },
            data: {
                title
            }
        })
    }
}

export const handleWsMsg = async (ws: Ws, msg: MsgToSrv) => {
    // console.log(`[${ws.data.store.connId}] message`, msg)
    if (msg.type === "Login") {
        const user = await prisma.user.findFirst({
            where: {
                username: msg.username,
                passwordHash: {
                    not: null
                }
            }
        })

        if (!user) {
            ws.send({
                type: "AuthTokenInvalid"
            });
            return;
        }

        if (!user.passwordHash) {
            console.error("user.passwordHash is undefined")
            ws.send({
                type: "AuthTokenInvalid"
            });
            return;
        }

        const isPasswordValid = Bun.password.verify(msg.password, user.passwordHash)

        if (!isPasswordValid) {
            console.error("password is invalid")
            ws.send({
                type: "AuthTokenInvalid"
            });
            return;
        }

        ws.state.user = user

        const token = await new SignJWT({ "userId": user.id })
            .setProtectedHeader({ alg })
            .sign(JWT_SECRET_KEY)

        ws.send({
            type: "Authenticated",
            token,
            version: catgptVersion
        })
    }

    if (msg.type === "Authenticate") {
        let payload

        try {
            const verifyRes = await jwtVerify(msg.token, JWT_SECRET_KEY)
            payload = verifyRes.payload
        } catch (err) {
            console.error(err)
            ws.send({
                type: "AuthTokenInvalid"
            });
            return;
        }

        if (!payload.userId) {
            console.error("payload.userId is undefined")
            ws.send({
                type: "AuthTokenInvalid"
            });
            return;
        }

        const userId = parseInt(payload.userId as string)

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        })

        if (!user) {
            console.error("user not found")

            ws.send({
                type: "AuthTokenInvalid"
            });
            return;
        }

        ws.state.user = user

        ws.send({
            type: "Authenticated",
            token: msg.token,
            version: catgptVersion
        });
    }

    if (!ws.state.user) {
        ws.send({
            type: "AuthTokenInvalid"
        });
        console.error("user not authenticated")
        return;
    }

    if (msg.type === "SendMsg") {
        await handleSendMsg(ws, msg)
    }

    if (msg.type === "GetChats") {
        const chats = await prisma.chat.findMany({
            take: msg.limit,
            skip: msg.offset,
            include: {
                messages: {
                    take: 1,
                    orderBy: {
                        timestamp: "desc"
                    },
                    select: {
                        timestamp: true
                    }
                }
            }
        })

        ws.send({
            type: "ChatMetas",
            metas: chats.map(chat => ({
                type: "ChatMeta",
                id: chat.id.toString(),
                title: chat.title || undefined,
                lastMsgDatetime: chat.messages[0]?.timestamp.toISOString() ?? ""
            }))
        })
    }

    if (msg.type === "GetChat") {
        const chat = await prisma.chat.findUnique({
            where: {
                id: parseInt(msg.chatId)
            },
            include: {
                messages: {
                    include: {
                        user: true
                    }
                }
            }
        })

        if (!chat) {
            console.error("chat not found")
            return;
        }

        ws.send({
            type: "Chat",
            id: chat.id + "",
            messages: chat.messages.map(msg => ({
                id: msg.id + "",
                chatId: msg.chatId + "",
                text: msg.text,
                tokenCount: msg.tokenCount,
                user: msg.user.username,
                datetime: msg.timestamp.toISOString(),
                bot: msg.user.isBot
            }))
        })
    }

    if (msg.type === "GenTitle") {
        const chat = await prisma.chat.findUnique({
            where: {
                id: parseInt(msg.chatId)
            },
            include: {
                messages: {
                    include: {
                        user: true
                    }
                }
            }
        })

        if (!chat) {
            console.error("chat not found")
            return;
        }

        ws.send({
            type: "ChatMeta",
            id: chat.id.toString(),
            title: "",
            lastMsgDatetime: ""
        })

        const messages: LLmMessage[] = []
        let totalTokenCount = 0

        for (const msg of chat.messages) {
            const tokens = encode(msg.text)
            const tokenCount = tokens.length

            let role: LLMMessageRole = "user"

            if (msg.user.isBot) {
                role = "assistant"
            }

            if (totalTokenCount + tokenCount > 2_000) {
                break
            }

            messages.push({
                role,
                content: msg.text
            })

            totalTokenCount += tokenCount
        }

        messages.reverse()

        messages.push({
            role: "user" as const,
            content: "summarise this conversation with very short sentence. Be very brief it is important!!"
        })

        const stream = await llmClient.streamRequest({
            model: "openai/gpt-3.5-turbo",
            messages
        })

        let title = ""

        for await (const event of stream) {
            if (event.type === "done") {
                break;
            }

            if (event.type === "delta") {
                title += event.delta

                ws.send({
                    type: "TitleDelta",
                    chatId: chat.id.toString(),
                    delta: event.delta
                })
            }
        }

        await prisma.chat.update({
            where: {
                id: chat.id
            },
            data: {
                title
            }
        })
    }

    if (msg.type === "GetBots") {
        const bots = await prisma.user.findMany({
            where: {
                isBot: true
            }
        })

        ws.send({
            type: "Bots",
            bots: bots.map(bot => ({
                id: bot.id.toString(),
                name: bot.username,
                model: bot.botModel as string,
                instructions: bot.botInstruction || undefined
            }))
        })
    }

    if (msg.type === "CreateBot") {
        console.log("createBot", msg)

        const bot = await prisma.user.create({
            data: {
                username: msg.name,
                botInstruction: msg.instructions,
                isBot: true,
                botModel: msg.model
            }
        })

        ws.send({
            type: "Bot",
            id: bot.id.toString(),
            name: bot.username,
            model: bot.botModel as string,
            instructions: bot.botInstruction || undefined
        })
    }

    if (msg.type === "UpdateBot") {
        console.log("updateBot", msg)

        const bot = await prisma.user.update({
            where: {
                id: parseInt(msg.id)
            },
            data: {
                username: msg.name,
                botInstruction: msg.instructions,
                botModel: msg.model
            }
        })

        ws.send({
            type: "Bot",
            id: bot.id.toString(),
            name: bot.username,
            instructions: bot.botInstruction || undefined,
            model: bot.botModel as string,
        })
    }
}