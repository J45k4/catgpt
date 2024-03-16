import React, { Fragment, useState } from "react"
import { ws } from "./ws"
import { Modal } from "./modal"
import { Bot, Model } from "../../types"
import { cache, notifyChanges, useCache } from "./cache"
import { ModelSelect } from "./model"
import { FaArrowLeft } from "react-icons/fa"

export const BotSelect = () => {
    const { botId, bots } = useCache(s => {
        return {
            botId: s.selectedBotId,
            bots: s.bots
        }
    })

    return (
        <select value={botId} onChange={e => {
            cache.selectedBotId = e.target.value
            localStorage.setItem("selectedBotId", e.target.value)
            notifyChanges()
        }}>
            <option disabled value="">Select a Bot</option>
            {bots.map((bot) => {
                return (
                    <option key={bot.id} value={bot.id}>
                        {bot.name}
                    </option>
                )
            })}
        </select>
    )
}

const AddBotModal = (props: {
    show: boolean
    onClose?: () => void
}) => {
    const [name, setName] = useState("")
    const [model, setModel] = useState<Model>("openai/gpt-3.5-turbo")
    const [instructions, setInstructions] = useState("")

    return (
        <Modal show={props.show} title="Create Bot" onClose={props.onClose}
            footerContent={
                <Fragment>
                    <button onClick={props.onClose}>
                        Cancel
                    </button>
                    <button onClick={() => {
                        ws.send({
                            type: "CreateBot",
                            name,
                            model: model as Model,
                            instructions
                        })
                        props.onClose?.()
                    }}>
                        Create Bot
                    </button>
                </Fragment>   
            }
        >
            <form>
                <div>
                    <div>
                        <label>
                            Name
                        </label>
                    </div>             
                    <input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                    <div>
                        <label>
                            Model Type
                        </label>
                    </div>  
                    <ModelSelect model={model} onSetModel={setModel} />
                </div>
                <div>
                    <label>
                        Instructions
                    </label>
                    <div>
                        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} />
                    </div>
                </div>
            </form>
        </Modal>
    )
}

const CreateBotForm = (props: {
    bot?: Bot
    onClose?: () => void
}) => {
    const [name, setName] = useState(props.bot?.name || "")
    const [model, setModel] = useState<Model>(props.bot?.model as Model || "openai/gpt-3.5-turbo")
    const [instructions, setInstructions] = useState(props.bot?.instructions || "")

    return (
        <form style={{ border: "solid 1px black", padding: "10px" }} onSubmit={e => e.preventDefault()}>
            <div>
                <div>
                    <label>
                        Name
                    </label>
                </div>             
                <input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
                <div>
                    <label>
                        Model Type
                    </label>
                </div>  
                <ModelSelect model={model} onSetModel={setModel} />
            </div>
            <div>
                <label>
                    Instructions
                </label>
                <div>
                    <textarea value={instructions} onChange={e => setInstructions(e.target.value)} />
                </div>
            </div>
            <div>
                <button onClick={props.onClose}>
                    Cancel
                </button>
                <button onClick={() => {
                    if (props.bot) {
                        ws.send({
                            type: "UpdateBot",
                            id: props.bot.id,
                            name,
                            model,
                            instructions
                        })
                    } else {
                        ws.send({
                            type: "CreateBot",
                            name,
                            model,
                            instructions
                        })
                    }
                    if (props.onClose) {
                        props.onClose()
                    }
                }}>
                    Create
                </button>
            </div>
        </form>
    )
}

export const BotsPage = (props: {
    style?: React.CSSProperties
    onSlideLeft?: () => void
}) => {
    const [showAddBotModal, setShowAddBotModal] = React.useState(false)
    const [editingBot, setEditingBot] = React.useState("")

    const bots = useCache(s => s.bots)

    return (
        <div style={{ display: "flex", flexDirection: "column", ...props.style }}>
            {props.onSlideLeft &&
            <div style={{ display: "flex" }}>
                <div className="icon_button" onClick={() => props.onSlideLeft()}>
                    <FaArrowLeft />
                </div>
            </div>}
            <button onClick={() => setShowAddBotModal(true)}>
                Add Bot
            </button>
            {showAddBotModal && <CreateBotForm onClose={() => setShowAddBotModal(false)} />} 
            {bots.map((bot) => {
                if (bot.id === editingBot) {
                    return <CreateBotForm bot={bot} onClose={() => setEditingBot("")} />
                }
                
                return (
                    <div key={bot.id} style={{ border: "1px solid black", margin: "10px", display: "flex", padding: "10px" }}>
                        <div key={bot.id} style={{ flexGrow: 1 }}>
                            <div>
                                Name: {bot.name}
                            </div>
                            <div>
                                Model: {bot.model}
                            </div>
                            <div>
                                Instructions: {bot.instructions}
                            </div>
                        </div>
                        <div style={{ padding: "5px" }}>
                            <button onClick={() => setEditingBot(bot.id)}>Edit</button>
                        </div>
                    </div>
                )
            })}
            
        </div>
    )
}