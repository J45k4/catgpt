import React, { useEffect } from "react"
import { ws } from "./ws"

export const BotsPage = () => {

    useEffect(() => {
        ws.send({
            type: "GetBots"
        })
    }, [])

    return (
        <div>
            Bots
        </div>
    )
}