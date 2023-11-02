import { ChatsList } from "./chats_list"
import { CurrentChat } from "./current_chat"
import { Personalities } from "./personalities"

export const MainPage = () => {
    return (
        <div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
                <ChatsList />
                <Personalities />
            </div>
            
            <CurrentChat />
        </div>
    )
}