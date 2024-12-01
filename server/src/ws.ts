import { encode } from "gpt-tokenizer";
import { LLMMessageRole, LLmMessage, State, WSContext as WsContext } from "./types";
import { Authenticate, CreateBot, GenTitle, GetBots, GetChat, GetChats, Login, MsgFromSrv, MsgToSrv, SendMsg, StopGeneration, UpdateBot } from "../../types";
import { prisma } from "./prisma";
import { SignJWT, jwtVerify } from "jose";
import { JWT_SECRET_KEY, catgptVersion } from "./config";
import { Model, modelSetings } from "../../models";

const alg = "HS256"

const handleSendMsg = async (msg: SendMsg, ctx: WsContext) => {
    if (!ctx.state.user) {
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

        ctx.send({
            type: "ChatCreated",
            chat: {
                id: chat.id.toString(),
                type: "Chat",
                msgs: []
            }
        })

        ctx.send({
            type: "NewChat",
            chat: {
                id: chat.id.toString(),
                type: "Chat",
                msgs: []
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

	const modelSettings = modelSetings[bot.botModel as Model]

	let contextSize = 3000
	let contextLimiting = true

	if (modelSettings) {
		if (modelSettings.contextSize) contextSize = modelSettings.contextSize
		if (modelSettings.noContextLimiting) contextLimiting = false
	}

    const tokens = encode(msg.txt)

    const chatMsg = await prisma.chatMsg.create({
        data: {
            text: msg.txt,
            timestamp: new Date(),
            chatId: chat.id,
            userId: ctx.state.user.id,
            tokenCount: tokens.length
        },
        include: {
            user: true
        }
    })
    chatMsgs.push(chatMsg)
    chatMsgs.reverse()

    ctx.send({
        type: "NewMsg",
        msg: {
            id: chatMsg.id.toString(),
            chatId: chat.id.toString(),
            text: chatMsg.text,
            tokenCount: chatMsg.tokenCount,
            user: ctx.state.user.username,
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

    ctx.send({
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
	const cutofftime = new Date().getTime() - (1000 * 60 * 15)

    for (const msg of chatMsgs) {
        const tokens = encode(msg.text)
        const tokenCount = tokens.length

        let role: LLMMessageRole = "user"

        if (msg.user.isBot) {
            role = "assistant"
        }

        if (totalTokenCount + tokenCount > contextSize) {
            break
        }

		if (contextLimiting) {
			if (messages.length > 1 && msg.timestamp.getTime() < cutofftime) {
				console.log("skipping old msg", msg)
				break
			}
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

	ctx.send({
		type: "GenerationStarted",
		chatId: chat.id.toString(),
	})

    try {
        const stream = await ctx.llmClient.streamRequest({
			id: chat.id.toString(),
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

                ctx.send({
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

        ctx.send({
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

        const text = ctx.state.user.admin ? err.message : "Sorry, I am not available at the moment. Please try again later."

        ctx.send({
            type: "MsgDelta",
            chatId: chat.id.toString(),
            msgId: botMsg.id.toString(),
            delta: text
        })
        await prisma.chatMsg.update({
            where: {
                id: botMsg.id
            },
            data: {
                text,
                tokenCount: 0,
                charCount: text.length
            }
        })
    }

	ctx.send({
		type: "GenerationFinished",
		chatId: chat.id.toString(),
	})

    if (!chat.title) {
        messages.push({
            role: "user" as const,
            content: "summarise this conversation with very short sentence. Be very brief it is important!!"
        })

        messages.shift()

        const titleStream = await ctx.llmClient.streamRequest({
			id: chat.id.toString(),
            model: "openai/gpt-4o-mini",
            messages
        })

        let title = ""

        for await (const event of titleStream) {
            if (event.type === "done") {
                break;
            }

            if (event.type === "delta") {
                title += event.delta

                ctx.send({
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

const handleLogin = async (msg: Login, ctx: WsContext) => {
	const user = await prisma.user.findFirst({
		where: {
			username: msg.username,
			passwordHash: {
				not: null
			}
		}
	})

	if (!user) {
		ctx.send({
			type: "AuthTokenInvalid"
		});
		return;
	}

	if (!user.passwordHash) {
		console.error("user.passwordHash is undefined")
		ctx.send({
			type: "AuthTokenInvalid"
		});
		return;
	}

	const isPasswordValid = Bun.password.verify(msg.password, user.passwordHash)

	if (!isPasswordValid) {
		console.error("password is invalid")
		ctx.send({
			type: "AuthTokenInvalid"
		});
		return;
	}

	ctx.state.user = user

	const token = await new SignJWT({ "userId": user.id })
		.setProtectedHeader({ alg })
		.sign(JWT_SECRET_KEY)

	ctx.send({
		type: "Authenticated",
		token,
		version: catgptVersion
	})
}

const handleAuthenticate = async (msg: Authenticate, ctx: WsContext) => {
	let payload

	try {
		const verifyRes = await jwtVerify(msg.token, JWT_SECRET_KEY)
		payload = verifyRes.payload
	} catch (err) {
		console.error(err)
		ctx.send({
			type: "AuthTokenInvalid"
		});
		return;
	}

	if (!payload.userId) {
		console.error("payload.userId is undefined")
		ctx.send({
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

		ctx.send({
			type: "AuthTokenInvalid"
		});
		return;
	}

	ctx.state.user = user

	ctx.send({
		type: "Authenticated",
		token: msg.token,
		version: catgptVersion
	});
}

const handleGetChats = async (msg: GetChats, ctx: WsContext) => {
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

	ctx.send({
		type: "ChatMetas",
		metas: chats.map(chat => ({
			type: "ChatMeta",
			id: chat.id.toString(),
			title: chat.title || undefined,
			lastMsgDatetime: chat.messages[0]?.timestamp.toISOString() ?? ""
		}))
	})
}

const handleGetChat = async (msg: GetChat, ctx: WsContext) => {
	const chat = await prisma.chat.findUnique({
		where: {
			id: parseInt(msg.chatId)
		},
		include: {
			messages: {
				include: {
					user: true
				},
				orderBy: {
					timestamp: "asc"
				}
			}
		}
	})

	if (!chat) {
		console.error("chat not found")
		return;
	}

	ctx.send({
		type: "Chat",
		id: chat.id + "",
		msgs: chat.messages.map(msg => ({
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

const handleGenTitle = async (msg: GenTitle, ctx: WsContext) => {
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

	ctx.send({
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

		if (totalTokenCount + tokenCount > 3000) {
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

	const stream = await ctx.llmClient.streamRequest({
		id: chat.id.toString(),
		model: "openai/gpt-4o-mini",
		messages
	})

	let title = ""

	for await (const event of stream) {
		if (event.type === "done") {
			break;
		}

		if (event.type === "delta") {
			title += event.delta

			ctx.send({
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

const handleGetBots = async (msg: GetBots, ctx: WsContext) => {
	const bots = await prisma.user.findMany({
		where: {
			isBot: true,
			disabled: false
		}
	})

	ctx.send({
		type: "Bots",
		bots: bots.map(bot => ({
			id: bot.id.toString(),
			name: bot.username,
			model: bot.botModel as string,
			instructions: bot.botInstruction || undefined
		}))
	})
}

const handleCreateBot = async (msg: CreateBot, ctx: WsContext) => {
	console.log("createBot", msg)

	const bot = await prisma.user.create({
		data: {
			username: msg.name,
			botInstruction: msg.instructions,
			isBot: true,
			botModel: msg.model
		}
	})

	ctx.send({
		type: "Bot",
		id: bot.id.toString(),
		name: bot.username,
		model: bot.botModel as string,
		instructions: bot.botInstruction || undefined
	})
}

const handleUpdateBot = async (msg: UpdateBot, ctx: WsContext) => {
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

	ctx.send({
		type: "Bot",
		id: bot.id.toString(),
		name: bot.username,
		instructions: bot.botInstruction || undefined,
		model: bot.botModel as string,
	})
}

const handleStopGenration = async (msg: StopGeneration, ctx: WsContext) => {
	ctx.llmClient.stopStream(msg.chatId)
}

export const handleWsMsg = async (msg: MsgToSrv, ctx: WsContext) => {
    if (msg.type === "Login") handleLogin(msg, ctx)
    if (msg.type === "Authenticate") handleAuthenticate(msg, ctx)
    if (!ctx.state.user) {
        ctx.send({
            type: "AuthTokenInvalid"
        });
        console.error("user not authenticated")
        return;
    }
    if (msg.type === "SendMsg") await handleSendMsg(msg, ctx)
    if (msg.type === "GetChats") await handleGetChats(msg, ctx)
    if (msg.type === "GetChat") await handleGetChat(msg, ctx)
    if (msg.type === "GenTitle") await handleGenTitle(msg, ctx)
    if (msg.type === "GetBots") await handleGetBots(msg, ctx)
    if (msg.type === "CreateBot") await handleCreateBot(msg, ctx)
    if (msg.type === "UpdateBot") await handleUpdateBot(msg, ctx)
	if (msg.type === "StopGeneration") await handleStopGenration(msg, ctx)
}