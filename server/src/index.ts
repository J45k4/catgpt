import { Chat, PrismaClient } from "@prisma/client";
import { Elysia, t } from "elysia";
import { jwt } from '@elysiajs/jwt';
import { MsgFromSrv } from "../../types"
import { WsStore } from "./ws_handler";
import { LLMClient } from "./llm_client";

const prisma = new PrismaClient();

const wsHandler = new WsStore()

const llmClient = new LLMClient({
	prisma,
	onEvent: (event) => {
		if (event.type === "Delta") {
			wsHandler.sendMsg({
				type: "MsgDelta",
				chatId: event.chatId + "",
				msgId: event.msgId + "",
				delta: event.delta
			})
		}
	}
})

const adminUser = await prisma.user.upsert({
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

console.log("adminUser", adminUser)

const app = new Elysia()
	.use(
		jwt({
			name: 'jwt',
			secret: 'secretkey',
		})
	)
	.get("/", () => "Hello Elysia")
	.ws("/ws", {
		body: t.Union([
			t.Object({
				type: t.Literal("Authenticate"),
				token: t.String()
			}),
			t.Object({
				type: t.Literal("GetChats"),
				offset: t.Optional(t.Number()),
				limit: t.Optional(t.Number())
			}),
			t.Object({
				type: t.Literal("Login"),
				username: t.String(),
				password: t.String()
			}),
			t.Object({
				type: t.Literal("SendMsg"),
				chatId: t.Optional(t.String()),
				txt: t.String()
			}),
			t.Object({
				type: t.Literal("GetChat"),
				chatId: t.String()
			})
		]),

		open: ws => {
			wsHandler.addConnection(ws)
		},
		close: ws => {
			wsHandler.removeConnection(ws)
		},
		async message(ws, msg) {
			console.log(`${ws.id} `, JSON.stringify(msg));	

			const sendMsg = (msg: MsgFromSrv) => {
				ws.send(JSON.stringify(msg));
			};

			if (msg.type === "Login") {
				console.log("Login")

				const token = await ws.data.jwt.sign({
					"userId": 1337
				})

				ws.send({
					type: "Authenticated",
					token
				})
			}

			if (msg.type === "Authenticate") {
				console.log("Authenticate");

				const payload = await ws.data.jwt.verify(msg.token);
				console.log("payload", payload);

				if (payload === false) {
					ws.send({
						type: "Unauthenticated"
					});
					return;
				}

				const token = msg.token;
				ws.send({
					type: "Authenticated",
					token: token
				});
			}

			if (msg.type === "SendMsg") {
				console.log("SendMsg");

				let chat: Chat | null = null

				if (msg.chatId) {
					chat = await prisma.chat.findFirst({
						where: {
							id: parseInt(msg.chatId)
						},
					})

					if (!chat) {
						console.error("chat not found")
						return;
					}
				}
				
				if (!chat) {
					chat = await prisma.chat.create({
						data: {
							title: "New Chat"
						}
					})
				}

				const chatMsg = await prisma.chatMsg.create({
					data: {
						text: msg.txt,
						timestamp: new Date(),
						chatId: chat.id,
						userId: adminUser.id
					},
				})

				const botMsg = await prisma.chatMsg.create({
					data: {
						text: "",
						timestamp: new Date(),
						chatId: chat.id,
						userId: 1337
					},
				})

				llmClient.streamRequest({
					provider: "OpenAI",
					chatId: chat.id,
					msgId: botMsg.id,
					messages: [{
						type: "user",
						text: msg.txt
					}]
				})

				const updatedChat = await prisma.chat.findUnique({
					where: {
						id: chat.id
					},
					include: {
						messages: {
							take: 1,
							orderBy: {
								timestamp: "desc"
							},
							include: {
								user: {
									select: {
										username: true,
										isBot: true
									}
								}
							}
						}
					}
				})

				console.log("updatedChat", updatedChat)

				sendMsg({
					type: "ChatCreated",
					chat: {
						id: updatedChat!.id.toString(),
						type: "Chat",
						messages: updatedChat!.messages.map(msg => ({
							id: msg.id.toString(),
							chatId: msg.chatId.toString(),
							text: msg.text,
							tokenCount: msg.tokenCount,
							user: msg.user.username,
							datetime: msg.timestamp.toISOString(),
							bot: msg.user.isBot
						}))
					}
				})
			}

			if (msg.type === "GetChats") {
				console.log("GetChats");

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

				sendMsg({
					type: "ChatMetas",
					metas: chats.map(chat => ({
						type: "ChatMeta",
						id: chat.id.toString(),
						title: chat.title,
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

				sendMsg({
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
		},
	})
	.listen(5566);