import { useEffect, useState } from "react"
import { events } from "./events"
import { ws } from "./ws"
import { state } from "./state"

export const Navbar = () => {
    const [connected, setConnected] = useState(ws.connected)
    const [authenticated, setAuthenticated] = useState(state.authenticated)

    useEffect(() => {
        events.subscribe({
            next: (event) => {
                if (event.type === "connected") {
                    setConnected(true)
                }

                if (event.type === "disconnected") {
                    setConnected(false)
                    setAuthenticated(false)
                }

                if (event.type === "Authenticated") {
                    setAuthenticated(true)
                    setConnected(true)
                }   
            }
        
        })
    }, [setConnected, setAuthenticated])

    console.log("authenticated", authenticated)

    return (
        <div style={{ display: "flex", flexWrap: "wrap" }}>
            <div style={{ color: "green", marginRight: "15px" }}>
                <div style={{ color: connected ? "green" : "red" }}>
                    {connected && "Connected"}
                    {!connected && "Disconnected"}
                </div>
                <div style={{ color: authenticated ? "green" : "red" }}>
                    {authenticated && "Authenticated"}
                    {!authenticated && "Not Authenticated"}
                </div>
            </div>
            <div style={{ marginRight: "15px" }}>
                <input type="text" placeholder="Search" />
            </div>
            <div>
                <button onClick={() => {
                    ws.disconnect()
                }}>
                    Reconnect
                </button>
            </div>
        </div>
    )
}