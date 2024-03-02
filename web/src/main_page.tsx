import { useCallback, useEffect, useRef, useState } from "react";
// import { ChatsList } from "./chats_list"
// import { CurrentChat } from "./current_chat"
import { FaBars, FaLongArrowAltRight } from "react-icons/fa";
import { FaRobot } from "react-icons/fa";
import { FaArrowLeft } from "react-icons/fa";
import { ChatsList } from "./chats_list";
import { BotSelect, BotsPage } from "./bot";
import { Editor } from "./editor";
import { cache, notifyChanges, useCache } from "./cache";
import { CurrentChat } from "./current_chat";
import { ws } from "./ws";

const Toolbar = (props: {
    left?: React.ReactNode
    center?: React.ReactNode
    right?: React.ReactNode
}) => {
    return (
        <div style={{ display: "flex", padding: "7px" }}>
            {props.left}
            <div style={{ flexGrow: 1, textAlign: "center" }}>
                {props.center}
            </div>
            {props.right}
        </div>
    )
}

const SlideNavigation = (props: {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	children: any[]
	indx: number
    onIndxChange?: (indx: number) => void
    style?: React.CSSProperties
}) => {
    const slideWrapper = useRef<HTMLDivElement>(null)
    const state = useRef({ x: 0, diff: 0, dragging: false })
    const [indx, setIndx] = useState(props.indx)

    useEffect(() => {
        setIndx(props.indx)
    }, [props.indx, setIndx])

    const changeIndx = (newIndx: number) => {
        setIndx(newIndx)
        if (props.onIndxChange) {
            props.onIndxChange(newIndx)
        }
    }

    const itemWidth = 100 / props.children.length

	return (
		<div className={`slide_navigation `}
			style={{
                ...props.style,
				width: "100%",
			}}
		>
			<div ref={slideWrapper} className="slide_wrapper" style={{
                transform: `translateX(-${indx * itemWidth}%)`,
                transition: "transform 0.3s ease-in-out",
            }}
            onTouchStart={(e) => {
                state.current.dragging = true
                state.current.x = e.touches[0].clientX
                if (slideWrapper.current) {
                    slideWrapper.current.style.transition = "none"
                }
            }}
            onTouchMove={(e) => {
                if (state.current.dragging && slideWrapper.current) {
                    state.current.diff = state.current.x - e.touches[0].clientX
                    const diffRatio = state.current.diff / window.innerWidth
                    const newx = ((indx * itemWidth) + (diffRatio * 50)) * -1
                    slideWrapper.current.style.transform = `translateX(${newx}%)`
                }
            }}
            onTouchEnd={(e) => {
                if (slideWrapper.current) {
                    slideWrapper.current.style.transition = "transform 0.3s ease-in-out"
                    slideWrapper.current.style.transform = `translateX(-${indx * itemWidth}%)`
                }

                if (state.current.diff > 100) {
                    changeIndx(Math.min(props.children.length - 1, indx + 1))
                }

                if (state.current.diff < -100) {
                    changeIndx(Math.max(0, indx - 1))
                }
                
                state.current.dragging = false
                state.current.diff = 0
                state.current.x = 0
            }}
            >
				{props.children.map((child, index) => {
					return (
						<div key={index} className={`slide_page`}>
							{child}
						</div>
					)
				})}
			</div>
		</div>
	)
}

const SendMessageBox = () => {
    const { currentMsg, selectedBotId, selectedChatId } = useCache(cache => {
        return {
            selectedChatId: cache.selectedChatId,
            selectedBotId: cache.selectedBotId,
            currentMsg: cache.currentMsg
        }
    })

    return (
        <div style={{ display: "flex" }}>
            <div style={{ flexGrow: 1 }}>
                <Editor 
                    content={currentMsg}
                    onChange={content => {
                        cache.currentMsg = content
                    }}
                />
            </div>  
            <button onClick={() => {
                if (!cache.currentMsg) {
                    return
                }

                ws.send({
                    type: "SendMsg",
                    botId: selectedBotId,
                    txt: cache.currentMsg,
                    chatId: selectedChatId
                })

                cache.currentMsg = ""
                notifyChanges()
            }}>
                Send
            </button>
        </div>
    )
}

const LoginForm = () => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const authFailed = useCache(s => s.authFailed)

    const onLogin = useCallback(() => {
        ws.send({
            type: "Login",
            username,
            password
        })
    }, [username, password])

    return (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
            {authFailed && <div style={{ color: "red" }}>Login failed</div>}
            <div>
                <input type="text" placeholder="username" value={username} onChange={e => setUsername(e.target.value)}
                    style={{ marginBottom: "10px" }}
                    onKeyUp={e => {
                        if (e.key === "Enter") {
                            onLogin()
                        }
                    }} />
                <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)}
                    style={{ marginBottom: "10px" }}
                    onKeyUp={e => {
                        if (e.key === "Enter") {
                            onLogin()
                        }
                    }} />
            </div>
            <button onClick={onLogin}>Login</button>
        </div>
    )
}

export const MainPage = () => {
    const { authenticated, inx } = useCache(s => {
        return {
            authenticated: s.authenticated,
            inx: s.pageInx
        }
    })

    const setIndx = useCallback((indx: number) => {
        cache.pageInx = indx
        notifyChanges()
    }, [])

    if (!authenticated) {
        return <LoginForm />
    }

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <SlideNavigation indx={inx} style={{ flexGrow: 1 }} onIndxChange={i => {
                setIndx(i)
            }}>
                <div>
                    <Toolbar 
                        left={<button onClick={() => {
                            localStorage.removeItem("token")
                            cache.authenticated = false
                            notifyChanges()
                        }}>Logout</button>}
                        right={<div className="icon_button" onClick={() => setIndx(1)}>
                            <FaLongArrowAltRight />
                        </div>} />
                    <ChatsList />
                </div>    
                <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <Toolbar
                        left={<div className="icon_button" onClick={() => {
                            setIndx(0)
                        }}>
                            <FaBars />
                        </div>}
                        center={<BotSelect />}
                        right={<div className="icon_button" onClick={() => {
                            setIndx(2)
                        }}>
                            <FaRobot />
                        </div>}
                    />
                    <div style={{ flexGrow: 1, textAlign: "center" }}>
                        {/* <ChatMessages chatId={cache.selectedChatId} /> */}
                        <CurrentChat />
                    </div>
                    <div style={{ padding: "20px" }}>
                        <SendMessageBox />
                    </div>
                </div>
                <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex" }}>
                        <div className="icon_button" onClick={() => setIndx(1)}>
                            <FaArrowLeft />
                        </div>
                    </div>
                    <BotsPage />
                </div>
            </SlideNavigation>
        </div>

    )
}