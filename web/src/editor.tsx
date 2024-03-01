import { useEffect, useRef } from "react"

const createLine = (args: {
    lineNumber: number
}) => {
    const line = document.createElement("div")
    line.style.minHeight = "20px"
    line.style.display = "flex"
    const lineNumber = document.createElement("div")
    lineNumber.innerHTML = args.lineNumber.toString()
    line.appendChild(lineNumber)
    const content = document.createElement("div")
    content.innerHTML = " "
    content.style.flexGrow = "1"
    line.appendChild(content)
    return {
        line,
        content
    }
}

class EditorInstance {
    private root: HTMLDivElement
    private content: string = ""
    
    public constructor(root: HTMLDivElement) {
        console.log("create editor instance")
        this.root = root
        this.root.contentEditable = "true"
        this.root.style.border = "1px solid #e0e0e0"
        this.root.style.padding = "10px"
        this.root.appendChild(createLine({
            lineNumber: 1
        }).line)

        this.root.onchange = () => {
            console.log("editor change")
        }

        this.root.onkeydown = (e) => {
            if (e.key === "ArrowLeft") {

            } else if (e.key === "ArrowRight") {
                
            } else if (e.key === "ArrowUp") {

            } else if (e.key === "ArrowDown") {

            } else if (e.key === "Enter") {
                e.preventDefault()
                this.insertLineBreak()
            } else {
                console.log(e.key)
            }
            
            console.log("editor keydown", e.key)
        }

        this.root.oninput = (e) => {
            console.log("editor input")
        }
    }

    private insertLineBreak() {
        const selection = window.getSelection()
        if (selection) {
            console.log("selection", selection)
            console.log("focusNode", selection?.focusNode)
            console.log("focusNodeParent", selection?.focusNode?.parentNode)

            let node = selection.focusNode
            if (node instanceof Text) {
                node = node.parentNode
            }

            const nextSibling = node.nextSibling
            const line = createLine({
                lineNumber: 2
            })
            if (nextSibling) {
                node.parentNode.insertBefore(line.line, nextSibling)
            } else {
                node.parentNode.appendChild(line.line)
            }

            selection.setPosition(line.content, 0)

            // let parent = selection.focusNode
            // if (parent !== this.root) {
            //     parent = parent?.parentNode
            // }

            // if (parent.nextSibling) {
            //     parent.parentNode.insertBefore(createLine(), parent.nextSibling)
            // } else {
            //     parent.parentNode.appendChild(createLine())
            // }

            // const range = selection.getRangeAt(0)
            // selection.focusNode.
            // const d = document.createElement("div")
            // d.style.minHeight = "20px"
            // range.insertNode(d)
            // d.focus()
            // selection.setPosition(d, 0)
        }
    }

    public destroy() {
        // this.root.remove()
        console.log("destroy editor instance")
        for (const child of this.root.children) {
            child.remove()
        }
    }
}

export const Editor = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = useRef<any>()

    useEffect(() => {
        console.log("Editor", r.current)

        const inst = new EditorInstance(r.current)

        return () => {
            inst.destroy()
        }
    }, [])

    return <div ref={r} />
}