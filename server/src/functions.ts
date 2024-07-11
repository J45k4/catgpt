export const functions = [{
	"name": "create_webpage",
	"description": "Creates runnable webpage with html, css, js. Use arguments for html, css, js code. Give full page html code in html argument.",
	"parameters": {
		"type": "object",
		"properties": {
			"title": {
				"type": "string",
				"description": "title of the webpage"
			},
			"html": {
				"type": "string",
				"description": "html code"
			},
			"js": {
				"type": "string",
				"description": "javascript code"
			},
			"css": {
				"type": "string",
				"description": "css code"
			}
		},
		"required": [
			"html",
			"title"
		]
	}
}]