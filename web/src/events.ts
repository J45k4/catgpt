import { Subject } from "rxjs";
import { MsgFromSrv } from "./types";

export type Connected = {
    type: "connected"
}

export type Disconnected = {
    type: "disconnected"
}

export type Event = Connected | Disconnected | MsgFromSrv

export const events = new Subject<Event>();

events.subscribe({
    next: (event) => {
        console.log("event", event)
    }
})