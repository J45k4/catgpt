import { User } from "@prisma/client"
import { MsgToSrv } from "../../types"
import { handleWsMsg } from "./ws"
import { State } from "./types"
import { createUsers } from "./users"
import { join } from "path"

const staticDir = "../web/dist"
const indexFilePath = `${staticDir}/index.html`
const indexFile = Bun.file(indexFilePath)

await createUsers()

let socketId = 1

Bun.serve<State>({
	port: 5566,
	fetch: async (req, server) => {
		const success = server.upgrade(req, {
			data: {
				socketId: socketId++
			}
		})

		if (success) {
			return undefined
		}

		const filepath = new URL(req.url).pathname
		const fullPath = join(staticDir, filepath)
		const file = Bun.file(fullPath)

		if (await file.exists()) {
			return new Response(file)
		}

		return new Response(indexFile)
	},
	websocket: {
		message: (ws, msg: string) => {
			const jsonMsg = JSON.parse(msg) as MsgToSrv

			handleWsMsg({
				state: ws.data,
				send: (msg) => ws.send(JSON.stringify(msg))
			}, jsonMsg)
		}
	}
})