import { ChatsList } from "./chats_list"
import { CurrentChat } from "./current_chat"

export const MainPage = () => {
    return (
        <div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
                <ChatsList />
            </div>
            
            <CurrentChat />
        </div>
    )
}