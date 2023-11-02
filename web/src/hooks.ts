import { useEffect, useState } from "react";
import { state } from "./state";
import { events } from "./events";
import { ws } from "./ws";

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