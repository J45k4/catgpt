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

export const formatDateTime = (date?: Date | string) => {
    if (!date) {
        return ""
    }

    const d = new Date(date)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
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