import { User } from "@prisma/client"
import { MsgToSrv } from "../../types"
import { handleWsMsg } from "./ws"
import { State } from "./types"
import { createUsers } from "./users"

await createUsers()

let socketId = 1

Bun.serve<State>({
	port: 5566,
	fetch: (req, server) => {
		const success = server.upgrade(req, {
			data: {
				socketId: socketId++
			}
		})

		if (success) {
			return undefined
		}
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