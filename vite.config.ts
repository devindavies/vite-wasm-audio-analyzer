import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-oxc";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
	],
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
			},
		},
	},
});
