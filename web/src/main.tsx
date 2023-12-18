import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import { Outlet, RouterProvider, createBrowserRouter } from "react-router-dom";
import { Navbar } from "./navbar.tsx";
import { MainPage } from "./main_page.tsx";
import { createConn } from "./ws.ts";
import { MainContainer } from "./main_container.tsx";
import { ProjectsPage } from "./projects.tsx";
import { BotsPage } from "./bot.tsx";

createConn()

const router = createBrowserRouter([
	{
		path: "/",
		element: (
			<MainContainer>
				<Navbar />
				<Outlet />
			</MainContainer>
		),
		children: [
			{
				path: "/",
				element: <MainPage />
			},
			{
				path: "/projects",
				element: <ProjectsPage />
			},
			{
				path: "/bots",
				element: <BotsPage />
			}
		]
	}
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>,
)
