import { useCallback, useEffect, useRef, useState } from "react";
import { FaBars, FaLongArrowAltRight } from "react-icons/fa";
import { FaRobot } from "react-icons/fa";
import { ChatsList } from "./chats_list";
import { BotSelect, BotsPage } from "./bot";
import { cache, notifyChanges, useCache } from "./cache";
import { CurrentChat, SendMessageBox } from "./current_chat";
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
    const state = useRef({ x: 0, y: 0, diff: 0, dragging: false })
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

    console.log("SlideNavigation  items" + props.children.length)
    console.log("SlideNavigation " + indx)

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
                    state.current.y = e.touches[0].clientY
                    if (slideWrapper.current) {
                        slideWrapper.current.style.transition = "none"
                    }
                }}
                onTouchMove={(e) => {
                    if (state.current.dragging && slideWrapper.current) {
                        const xDiff = Math.abs(e.touches[0].clientX - state.current.x)
                        const yDiff = Math.abs(e.touches[0].clientY - state.current.y)

                        if (yDiff > xDiff) {
                            return
                        }

                        state.current.diff = state.current.x - e.touches[0].clientX
                        const diffRatio = state.current.diff / window.innerWidth
                        const newx = ((indx * itemWidth) + (diffRatio * 50)) * -1
                        slideWrapper.current.style.transform = `translateX(${newx}%)`
                    }
                }}
                onTouchEnd={() => {
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

const ChatsPage = (props: {
    style?: React.CSSProperties
    onSlideRight?: () => void
}) => {
    return (
        <div style={props.style}>
            <Toolbar
                left={<button onClick={() => {
                    localStorage.removeItem("token")
                    cache.authenticated = false
                    notifyChanges()
                }}>Logout</button>}
                right={props.onSlideRight ? <div className="icon_button" onClick={props.onSlideRight}>
                    <FaLongArrowAltRight />
                </div> : undefined} />
            <ChatsList />
        </div>
    )
}

const CurrentChagePage = (props: {
    style?: React.CSSProperties
    onSlideLeft?: () => void
    onSlideRight?: () => void
}) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", ...props.style }}>
            <Toolbar
                left={props.onSlideLeft ? <div className="icon_button" onClick={() => {
                    props.onSlideLeft()
                }}>
                    <FaBars />
                </div> : undefined}
                center={<BotSelect />}
                right={props.onSlideRight ? <div className="icon_button" onClick={props.onSlideRight}>
                    <FaRobot />
                </div> : undefined}
            />
            <div style={{ flexGrow: 1, overflow: "auto", textAlign: "center", width: "100%" }}>
                <CurrentChat />
            </div>
            <div style={{ padding: "20px" }}>
                <SendMessageBox />
            </div>
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

    const slideLeft = useCallback(() => {
        if (inx === 0) {
            return
        }
        setIndx(inx - 1)
    }, [inx, setIndx])

    const slideRight = useCallback(() => {
        if (inx === 2) {
            return
        }
        setIndx(inx + 1)
    }, [inx, setIndx])

    if (!authenticated) {
        return <LoginForm />
    }

    return (
        <SlideNavigation indx={inx} style={{ flexGrow: 1 }} onIndxChange={i => {
            setIndx(i)
        }}>
            <ChatsPage onSlideRight={slideRight} />
            <CurrentChagePage onSlideLeft={slideLeft} onSlideRight={slideRight} />
            <BotsPage onSlideLeft={slideLeft} />
        </SlideNavigation>
    )
}