import { exists, mkdir } from "node:fs/promises";
import { join } from "node:path";

type Call = {
	name: string
	index: number
	args: any
}

const artifactFolder = "./artifacts"

// mkdir(artifactFolder)

export class Calls {
	private calls: Call[] = []

	public add(args: {
		name?: string
		index: number
		args?: any
	}) {
		let call = this.calls.find(c => c.index === args.index)

		if (!call) {
			call = {
				name: args.name || "",
				index: args.index,
				args: ""
			}
			this.calls.push(call)
		}

		call.args += args.args
	}

	public async execute() {
		for (const call of this.calls) {
			const args = JSON.parse(call.args)
			console.log("Executing", call.name, args)

			const now = new Date()
			let path = join(artifactFolder, args.title + "-" + `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`)

			console.log("path", path)

			await mkdir(path)

			if (call.name === "create_webpage") {
				Bun.write(join(path, "index.html"), args.html)
				if (args.css) {
					Bun.write(join(path, "style.css"), args.css)
				}
				if (args.js) {
					Bun.write(join(path, "script.js"), args.js)
				}
			}
		}
	}
}