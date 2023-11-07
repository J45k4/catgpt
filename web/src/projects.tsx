// import { ws } from "./ws"

export const ProjectsPage = () => {
    const projects = [
        "project1",
        "project2",
        "project3",
        "project4",
        "project5",
    ]

    return (
        <div>
            <button>
                New Project
            </button>
            <div>
                {projects.map((project) => {
                    return (
                        <div>
                            <div>
                                {project}
                            </div>
                            <div>
                                <button>
                                    Delete
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}