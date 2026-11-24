import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react({ compiler: true }), tailwindcss()],
	build: {
		rolldownOptions: {
			input: {
				main: resolve(import.meta.dirname, "index.html"),
			},
		},
	},
});
