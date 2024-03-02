import React, { Fragment, useState } from "react"
import { ws } from "./ws"
import { Modal } from "./modal"
import { Model } from "../../types"
import { cache, notifyChanges, useCache } from "./cache"
import { ModelSelect } from "./model"

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

export const BotsPage = () => {
    const [showAddBotModal, setShowAddBotModal] = React.useState(false)

    const bots = useCache(s => s.bots)

    return (
        <div>
            <button onClick={() => setShowAddBotModal(true)}>
                Add Bot
            </button> 
            {bots.map((bot) => {
                return (
                    <div key={bot.id} style={{ border: "1px solid black", margin: "10px" }}>
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
                )
            })}

            <AddBotModal show={showAddBotModal}
                onClose={() => setShowAddBotModal(false)} />
        </div>
    )
}