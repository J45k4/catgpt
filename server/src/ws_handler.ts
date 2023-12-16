import { MsgFromSrv } from "../../types"

export type Ws = {
    id: number
    send: (msg: MsgFromSrv) => void
}

export class WsStore {
    private websockets = new Map<number, Ws>()

    public addConnection(ws: Ws) {
        this.websockets.set(ws.id, ws)
    }

    public removeConnection(ws: Ws) {
        this.websockets.delete(ws.id)
    }

    public sendMsg(msg: MsgFromSrv) {
        for (const ws of this.websockets.values()) {
            ws.send(msg)
        }
    }
}