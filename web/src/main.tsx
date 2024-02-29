import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import { createConn } from "./ws.ts";
import { FaBars } from "react-icons/fa";
import { MainPage } from "./main_page.tsx";

createConn()

// const router = createBrowserRouter([
// 	{
// 		path: "/",
// 		element: (
// 			<MainContainer>
// 				<Navbar />
// 				<Outlet />
// 			</MainContainer>
// 		),
// 		children: [
// 			{
// 				path: "/",
// 				element: <MainPage />
// 			},
// 			{
// 				path: "/projects",
// 				element: <ProjectsPage />
// 			},
// 			{
// 				path: "/bots",
// 				element: <BotsPage />
// 			}
// 		]
// 	}
// ]);



ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<MainPage />
	</React.StrictMode>,
)
