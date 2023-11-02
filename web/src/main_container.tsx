import { LoginPage } from "./login_page"
import { Navbar } from "./navbar"
import { useAuthenticated, useConnected } from "./hooks"

export const MainContainer = (props: {
    children: React.ReactNode
}) => {
    const authenticated = useAuthenticated()
    const connected = useConnected()

    console.log("authenticated", authenticated)
    console.log("connected", connected)

    if (!connected) {
        return (
            <Navbar />
        )
    }

    if (!authenticated) {
        return (
            <LoginPage />
        )
    }

    return (
        <div style={{ margin: "15px" }}>
            {props.children}
        </div>
    )
}