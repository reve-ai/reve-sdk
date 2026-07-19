import { defineConfig } from "vite";

// Bundles the SDK into a single ESM file for modern browsers. Type
// declarations are emitted separately by `tsc --emitDeclarationOnly`.
export default defineConfig({
	build: {
		target: "es2022",
		sourcemap: true,
		lib: {
			entry: "src/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
	},
});
