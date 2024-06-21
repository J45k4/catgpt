import { useEffect, useState } from "react"

export const updateQueryParam = (param: string, value: string) => {
    const url = new URL(window.location.href)
    if (value != null) {
        url.searchParams.set(param, value)
    } else {
        url.searchParams.delete(param)
    }
    window.history.replaceState({}, "", url.toString())
}

export const clearQueryParam = (param: string) => {
    const url = new URL(window.location.href)
    url.searchParams.delete(param)
    window.history.replaceState({}, "", url.toString())
}

export const getQueryParam = (param: string) => {
    const url = new URL(window.location.href)
    return url.searchParams.get(param)
}

const numToString = (num: number, minDigits: number) => {
	let str = num.toString()
	while (str.length < minDigits) {
		str = `0${str}`
	}
	return str
}

export const formatDateTime = (date?: Date | string) => {
    if (!date) {
        return ""
    }

    const d = new Date(date)
	const dateStr = numToString(d.getDate(), 2)
	const monthStr = numToString(d.getMonth() + 1, 2)
	const hoursStr = numToString(d.getHours(), 2)
	const minutesStr = numToString(d.getMinutes(), 2)
	const secondsStr = numToString(d.getSeconds(), 2)

    return `${d.getFullYear()}-${monthStr}-${dateStr} ${hoursStr}:${minutesStr}:${secondsStr}`
}

export const useScreenSize = () => {
    const [width, setWidth] = useState(window.innerWidth)

    useEffect(() => {
        const handleResize = () => {
            setWidth(window.innerWidth)
        }

        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    return width
}