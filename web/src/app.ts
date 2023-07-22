
class ModelSelection extends HTMLSelectElement {
    constructor() {
        super()

        this.appendChild(document.createElement("option"))
        this.appendChild(document.createElement("option"))
        this.appendChild(document.createElement("option"))
    }
}

window.onload = () => {
    const body = document.querySelector("body")

    console.log(body)

    const modelSelection = new ModelSelection()

    body.appendChild(modelSelection)
}