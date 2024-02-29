import { useEffect, useRef, useState } from "react";
// import { ChatsList } from "./chats_list"
// import { CurrentChat } from "./current_chat"
import { FaBars, FaLongArrowAltRight } from "react-icons/fa";
import { ChatsList } from "./chats_list";

// const SlidePage = (props: {
// 	indx: number
// 	children: any
// }) => {
// 	return (
// 		<div className={`slide_page_${props.indx}`}>
// 			{props.children}
// 		</div>
// 	)
// }

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

	return (
		<div className={`slide_navigation `}
			style={{
                ...props.style,
				width: "100%",
			}}
		>
			<div ref={slideWrapper} className="slide_wrapper" style={{
                transform: `translateX(-${indx * 50}%)`,
                transition: "transform 0.3s ease-in-out",
            }}
            onTouchStart={(e) => {
                console.log("start touchging", e)
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
                    const newx = ((indx * 50) + (diffRatio * 50)) * -1
                    slideWrapper.current.style.transform = `translateX(${newx}%)`
                }
            }}
            onTouchEnd={(e) => {
                if (slideWrapper.current) {
                    slideWrapper.current.style.transition = "transform 0.3s ease-in-out"
                    slideWrapper.current.style.transform = `translateX(-${indx * 50}%)`
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
                console.log("end touching", e)
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
                    <div onClick={() => setIndx(1)}>
                        <FaLongArrowAltRight />
                    </div>
                    <ChatsList />
                </div>
                <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", padding: "7px" }} onClick={() => {
                        setIndx(0)
                    }}>
                        <FaBars />
                    </div>
                    <div style={{ flexGrow: 1, textAlign: "center" }}>
                        Beeb boop I'm a robot
                    </div>
                    <div>
                        <input type="text" placeholder="Search" />
                    </div>
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