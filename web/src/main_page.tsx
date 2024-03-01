import { useEffect, useRef, useState } from "react";
// import { ChatsList } from "./chats_list"
// import { CurrentChat } from "./current_chat"
import { FaBars, FaLongArrowAltRight } from "react-icons/fa";
import { FaRobot } from "react-icons/fa";
import { FaArrowLeft } from "react-icons/fa";
import { ChatsList } from "./chats_list";
import { BotsPage } from "./bot";
import { Editor } from "./editor";

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
    style?: React.CSSProperties
}) => {
    const slideWrapper = useRef<HTMLDivElement>(null)
    const state = useRef({ x: 0, diff: 0, dragging: false })
    const [indx, setIndx] = useState(props.indx)

    useEffect(() => {
        setIndx(props.indx)
    }, [props.indx])

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
                    setIndx(Math.min(props.children.length - 1, indx + 1))
                }

                if (state.current.diff < -100) {
                    setIndx(Math.max(0, indx - 1))
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

export const MainPage = () => {
    const [indx, setIndx] = useState(1)

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <SlideNavigation indx={indx} style={{ flexGrow: 1 }}>
                <div>
                    <Toolbar 
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
                        center={<div>model</div>}
                        right={<div className="icon_button" onClick={() => {
                            setIndx(2)
                        }}>
                            <FaRobot />
                        </div>}
                    />
                    <div style={{ flexGrow: 1, textAlign: "center" }}>
                        Beeb boop I'm a robot
                    </div>
                    <div style={{ padding: "20px" }}>
                        <Editor />
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
            {/* <div style={{ display: "flex" }}>
                <button onClick={() => setIndx(Math.max(0, indx - 1))}>
                    left
                </button>
                <button onClick={() => setIndx(Math.min(1, indx + 1))}>
                    right
                </button>
            </div>    */}
        </div>

    )
}