import { useEffect, useState } from "react"
import { Bot, ChatMsg } from "../../types"
import { getQueryParam } from "./utility"

type Chat = {
    id: string
    title?: string
    lastMsgDatetime: string
    msgs: ChatMsg[]
}

const getBotsFromLocalStorage = () => {
	const bots = localStorage.getItem("bots")
	if (bots) {
		return JSON.parse(bots) as Bot[]
	}
	return []
}

const bots = getBotsFromLocalStorage()
const selectedBotId = localStorage.getItem("selectedBotId") ?? ""

export const cache = {
	initialLoading: true,
    token: "",
    connected: false,
    authenticated: false,
    authFailed: false,
    currentMsg: "",
    version: "",
    selectedChatId: getQueryParam("chatId") ?? "",
    selectedBotId: bots.find(b => b.id === selectedBotId) ? selectedBotId : bots.find(p => p.name === "aki")?.id ?? bots[0]?.id ?? "",
    generalErrorMsg: "",
    pageInx: 1,
    chatMsgs: new Map<string, ChatMsg>(),
    chats: new Map<string, Chat>(),
    bots
}

const listeners = new Set<() => void>()

let tim

export const notifyChanges = () => {
    if (tim) {
        return
    }

    tim = setTimeout(() => {
        tim = null
        for (const listener of listeners) {
            listener()
        }
    }, 16)
}

function deepClone<T>(item: T): T {
    if (item === null || typeof item !== 'object') {
        // Return the value if item is not an object or is null
        return item;
    }

    if (Array.isArray(item)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const copy = [] as any[];
        for (const [index, value] of item.entries()) {
            copy[index] = deepClone(value);
        }
        return copy as T;
    }

    if (item instanceof Date) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new Date(item.getTime()) as any;
    }

    if (item instanceof Object) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const copy = {} as { [key: string]: any };
        for (const [key, value] of Object.entries(item)) {
            copy[key] = deepClone(value);
        }
        return copy as T;
    }

    // If the type isn't specifically handled above, just return it.
    throw new Error("Unable to copy item! Its type isn't supported.");
}

export const useCache = <T>(mapper: (state: typeof cache) => T) => {
    const [state, setState] = useState<T>(mapper(cache))

    useEffect(() => {
        function listener() {
            setState(deepClone(mapper(cache)))
        }

        listeners.add(listener)

        return () => {
            listeners.delete(listener)
        }
    }, [mapper, setState])

    return state
}
