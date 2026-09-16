import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import prettier from "eslint-plugin-prettier";

export default defineConfig([
    { ignores: ["dist/**"] },
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        plugins: { js, prettier },
        extends: ["js/recommended"],
        rules: {
            "prettier/prettier": [
                "warn",
                {
                    semi: true,
                    singleQuote: false,
                    tabWidth: 4,
                    trailingComma: "all",
                    endOfLine: "auto",
                },
            ],
        },
    },
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        languageOptions: { globals: globals.browser },
    },
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    eslintPluginPrettier,
]);
