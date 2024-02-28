import { useEffect, useState } from "react"
import { Bot } from "../../types"

export const cache = {
    selectedBotId: "",
    generalErrorMsg: "",
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