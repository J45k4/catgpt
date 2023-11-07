import { CSSProperties } from "react"

export const Row = (props: {
    children: React.ReactNode
    style?: CSSProperties
}) => {
    if (props.children instanceof Array) {
        return (
            <div style={{ display: "flex", ...props.style }}>
                {props.children.map((child, index) => {
                    return (
                        <div key={index} style={{ marginRight: "15px" }}>
                            {child}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div style={{ display: "flex", ...props.style }}>
            {props.children}
        </div>
    )
}