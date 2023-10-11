import { createConn, ws } from "./ws";

window.onload = () => {
    createConn();
    
    const username = document.getElementById("username") as HTMLInputElement;
    const password = document.getElementById("password") as HTMLInputElement;
    const loginButton = document.getElementById("login_button") as HTMLButtonElement;

    loginButton.onclick = e => {
        e.preventDefault();

        const usernameValue = username.value;
        const passwordValue = password.value;

        console.log("login now", {
            username: usernameValue,
            password: passwordValue
        });

        ws.send({
            type: "Login",
            username: usernameValue,
            password: passwordValue
        })
    }

    ws.on_msg = msg => {
        if (msg.type === "Authenticated") {
            console.log("authenticated", msg);
            localStorage.setItem("token", msg.token);
            window.location.href = "/";
        }
    }
}