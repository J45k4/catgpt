import { useEffect, useState } from "react";
import { state } from "./state";
import { events } from "./events";
import { ws } from "./ws";
import { clearQueryParam, updateQueryParam } from "./utility";

export const useAuthenticated = () => {
    const [authenticated, setAuthenticated] = useState(state.authenticated);

    useEffect(() => {
        const sub = events.subscribe({
            next: (event) => {
                if (event.type === "Authenticated") {
                    setAuthenticated(true);
                }
                
                if (event.type === "disconnected") {
                    setAuthenticated(false);
                }
            }
        })

        return () => {
            sub.unsubscribe();
        }
    }, [setAuthenticated])

    return authenticated;
}

export const useConnected = () => {
    const [connected, setConnected] = useState(ws.connected);

    useEffect(() => {
        const sub = events.subscribe({
            next: (event) => {
                if (event.type === "connected") {
                    setConnected(true);
                }
                
                if (event.type === "disconnected") {
                    setConnected(false);
                }

                if (event.type === "Authenticated") {
                    setConnected(true);
                }
            }
        })

        return () => {
            sub.unsubscribe();
        }
    }, [setConnected])

    return connected;
}

export const useSelectedChatId = () => {
    const [selectedChatId, setSelectedChatId] = useState(state.selectedChatId)

    useEffect(() => {
        const sub = events.subscribe({
            next: (event) => {
                if (event.type === "selectedChatChanged") {
                    setSelectedChatId(event.chatId)

                    if (event.chatId) {
                        updateQueryParam("chatId", event.chatId)
                        ws.send({
                            type: "GetChat",
                            chatId: event.chatId
                        })
                    } else {
                        clearQueryParam("chatId")
                    }
                    state.selectedChatId = event.chatId
                }

                if (event.type === "ChatCreated") {
                    setSelectedChatId(event.chat.id)
                    state.selectedChatId = event.chat.id
                    updateQueryParam("chatId", event.chat.id)
                }
            }
        })

        return () => {
            sub.unsubscribe();
        }
    }, [setSelectedChatId])

    const change = (chatId: string | null) => {
        events.next({
            type: "selectedChatChanged",
            chatId
        })
    }

    return [selectedChatId, change] as const;
}