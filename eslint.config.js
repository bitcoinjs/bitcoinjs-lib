import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends(
    "eslint:recommended",
    "prettier",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.amd,
            ...globals.node,
        },

        parser: tsParser,
    },

    rules: {
        "prettier/prettier": ["error", {
            singleQuote: true,
            trailingComma: "all",
            endOfLine: "auto",
            arrowParens: "avoid",
            tabWidth: 2,
        }],

        "arrow-body-style": "off",
        "prefer-arrow-callback": "off",
        "@typescript-eslint/array-type": 0,
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "arrow-parens": "off",
        curly: "off",
        "no-case-declarations": "off",
        quotes: "off",

        "@/quotes": ["error", "single", {
            avoidEscape: true,
            allowTemplateLiterals: true,
        }],

        "prefer-rest-params": "off",
        "no-bitwise": "off",
        "no-console": "off",

        "no-empty": ["error", {
            allowEmptyCatch: true,
        }],

        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "no-unused-expressions": "off",
        "@typescript-eslint/no-unused-expressions": "off",
        "@typescript-eslint/no-empty-object-type": "off",
        "space-before-function-paren": "off",
    },
}];