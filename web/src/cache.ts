import { useEffect, useState } from "react"
import { Bot, ChatMsg } from "../../types"

type Chat = {
    id: string
    title?: string
}

export const cache = {
    selectedBotId: "",
    generalErrorMsg: "",
    chatMsgs: new Map<string, ChatMsg>(),
    chats: new Map<string, Chat>(),
    bots: [] as Bot[],
}

const listeners = new Set<() => void>()

export const notifyChanges = () => {
    console.log("notifyChanges", cache)

    for (const listener of listeners) {
        listener()
    }
}

export const useCache = <T>(mapper: (state: typeof cache) => T) => {
    const [state, setState] = useState<T>(mapper(cache))

    useEffect(() => {
        const listener = () => {
            setState(mapper(cache))
        }

        listeners.add(listener)

        return () => {
            listeners.delete(listener)
        }
    }, [mapper, setState])

    return state
}