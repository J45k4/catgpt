import { Subject } from "rxjs";
import { MsgFromSrv } from "./types";

export type Connected = {
    type: "connected"
}

export type Disconnected = {
    type: "disconnected"
}

export type SelectedChatChanged = {
    type: "selectedChatChanged"
    chatId: string | null
}

export type Event = Connected | Disconnected | MsgFromSrv | SelectedChatChanged

export const events = new Subject<Event>();

events.subscribe({
    next: (event) => {
        console.log("event", event)
    }
})