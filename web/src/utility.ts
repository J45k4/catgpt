export const updateQueryParam = (param: string, value: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set(param, value)
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