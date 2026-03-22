import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
	js.configs.recommended,
	...tseslint.configs.recommended,

	{
		ignores: ["node_modules", "dist", "drizzle"],
		files: ["**/*.{ts,js}"],
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			"no-console": "off",
			"@typescript-eslint/no-unused-vars": "warn",
			"no-async-promise-executor": "error",
			"require-await": "warn",
		},
	},

	prettier,
]);
