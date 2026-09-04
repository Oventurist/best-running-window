import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**"],
  },
  {
    files: ["js/**/*.js", "tests/**/*.js", "tailwind.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // App code runs in the browser (and is dragged through jsdom in tests).
    files: ["js/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.jquery },
    },
  },
  {
    // Vitest executes under Node but exercises DOM globals; tailwind.config.js
    // is loaded by the Tailwind CLI under Node.
    files: ["tests/**/*.js", "tailwind.config.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
];
