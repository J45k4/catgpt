import React, { Fragment, useEffect } from "react"
import { ws } from "./ws"
import { Modal } from "./modal"
import { modelTypes } from "../../types"

const AddBotModal = (props: {
    show: boolean
    onClose?: () => void
}) => {
    return (
        <Modal show={props.show} title="Create Bot" onClose={props.onClose}
            footerContent={
                <Fragment>
                    <button onClick={props.onClose}>
                        Cancel
                    </button>
                    <button>
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
                    <input />
                </div>
                <div>
                    <div>
                        <label>
                            Model Type
                        </label>
                    </div>  
                    <select>
                        {modelTypes.map((modelType) => {
                            return (
                                <option key={modelType}>
                                    {modelType}
                                </option>
                            )
                        })}
                    </select>
                </div>
                <div>
                    <label>
                        Instructions
                    </label>
                    <div>
                        <textarea />
                    </div>
                </div>
            </form>
        </Modal>
    )
}

export const BotsPage = () => {
    const [showAddBotModal, setShowAddBotModal] = React.useState(false)

    useEffect(() => {
        ws.send({
            type: "GetBots"
        })
    }, [])

    return (
        <div>
            <button onClick={() => setShowAddBotModal(true)}>
                Add Bot
            </button>

            <AddBotModal show={showAddBotModal}
                onClose={() => setShowAddBotModal(false)} />
        </div>
    )
}