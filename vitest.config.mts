import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			// The `obsidian` package has no runtime entry (main: ""), only types.
			obsidian: path.resolve(
				__dirname,
				"src/__tests__/mocks/obsidian.ts",
			),
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		include: ["src/**/*.test.ts"],
		setupFiles: ["src/__tests__/setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/__tests__/**"],
		},
	},
});
