import { useState } from "react"
import { ws } from "./ws"

export const LoginPage = () => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    return (
        <div>
            <form>
                <div>
                    <label>Username</label>
                    <input name="username" type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)} />
                </div>
                <div>
                    <label>Password</label>
                    <input name="password" type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)} />
                </div>
                <div>
                    <button type="submit" onClick={(e) => {
                        e.preventDefault()
                        ws.send({
                            type: "Login",
                            username,
                            password
                        })
                    }}>
                        Login
                    </button>
                </div>
            </form>
        </div>
    )
}