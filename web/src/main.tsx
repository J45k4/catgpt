import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import { createConn } from "./ws.ts";
import { MainPage } from "./main_page.tsx";

createConn()

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<MainPage />
	</React.StrictMode>,
)
