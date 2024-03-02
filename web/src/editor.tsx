import { useEffect, useRef } from "react"

const createLine = (arg?: { text?: string }) => {
    const line = document.createElement("div")
    line.style.minHeight = "20px"
    line.style.display = "flex"

    if (arg?.text) {
        line.innerText = arg.text
    }
    return line
}

class EditorInstance {
    private root: HTMLDivElement
    private content: string = ""
    
    public constructor(args: {
        root: HTMLDivElement
        onChange?: (content: string) => void
    }) {
        this.root = args.root
        this.root.contentEditable = "true"
        this.root.style.border = "1px solid #e0e0e0"
        this.root.style.padding = "10px"
        this.root.appendChild(createLine())

        this.root.onkeydown = (e) => {
            if (e.key === "ArrowLeft") {

            } else if (e.key === "ArrowRight") {
                
            } else if (e.key === "ArrowUp") {

            } else if (e.key === "ArrowDown") {
            
            } else if (e.key === "Shift") {

            } else if (e.key === "Backspace") {
                this.content = this.content.slice(0, -1)
            } else if (e.key === "Enter") {
                e.preventDefault()
                this.insertLineBreak()
                this.content += "\n"
                args.onChange(this.content)
            } else {
                this.content += e.key
                args.onChange(this.content)
            }
        }
    }

    private insertLineBreak() {
        const selection = window.getSelection()
        if (selection) {
            let leftOverText = ""
            let node = selection.focusNode
            if (node instanceof Text) {
                leftOverText = node.textContent?.slice(selection.focusOffset) || ""
                node.textContent = node.textContent?.slice(0, selection.focusOffset) || ""
                node = node.parentNode
            }

            const nextSibling = node.nextSibling
            const line = createLine({ text: leftOverText })
            if (nextSibling) {
                node.parentNode.insertBefore(line, nextSibling)
            } else {
                node.parentNode.appendChild(line)
            }

            selection.setPosition(line, 0)
        }
    }

    public setContent(content: string) {
        if (content === this.content) {
            return
        }

        this.clear()
        this.content = content

        const lines = content.split("\n")

        for (const line of lines) {
            this.root.appendChild(createLine({ text: line }))
        }
    }

    public clear() {
        for (const child of this.root.children) {
            child.remove()
        }
    }
}

export const Editor = (props: {
    content: string
    onChange: (content: string) => void
}) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = useRef<any>()
    const instance = useRef<EditorInstance>()

    useEffect(() => {
        instance.current = new EditorInstance({
            root: r.current,
            onChange: (content) => {
                props.onChange(content)
            }
        })

        return () => {
            instance.current.clear()
        }
    }, [props])

    useEffect(() => {
        instance.current?.setContent(props.content)
    }, [props.content])

    return <div ref={r} />
}