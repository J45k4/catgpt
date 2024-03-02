import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	preview: {
		port: 7777,
		host: "0.0.0.0"
	},
	server: {
		host: "0.0.0.0",
		port: 7777
	}
})
