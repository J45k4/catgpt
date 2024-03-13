
export const lazy = <T>(fn: () => T) => {
    let value: T | undefined

    return () => {
        if (value === undefined) {
            value = fn()
        }

        return value
    }
}