import eslintReact from "@eslint-react/eslint-plugin";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import { builtinModules } from "node:module";

import noBluebirdPromiseAliasRule from "./eslint-rules/no-bluebird-promise-alias.mjs";
import noBluebirdResolveWithPromiseLike from "./eslint-rules/no-bluebird-resolve-promiselike.mjs";
import noRestrictedImportsRule from "./eslint-rules/no-restricted-imports.mjs";

const isCI = !!process.env.CI;
const tseslintConfig = isCI
  ? tseslint.configs.recommended
  : tseslint.configs.recommendedTypeChecked;

export default defineConfig([
  // ─── Global ignores ─────────────────────────────────────────────────────────
  {
    ignores: [
      // NOTE(erri120): old tests and mocks
      "**/__mocks__/**",
      "**/__tests__/**",

      // Build outputs
      "**/dist/**",
      "**/out/**",
      "**/lib/**",
    ],
  },

  // ─── Global: base configs ────────────────────────────────────────────────────
  // These apply to all files matched by per-package `files` globs below.
  {
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    extends: [eslint.configs.recommended, tseslintConfig, prettierConfig],
    languageOptions: {
      parserOptions: {
        projectService: !isCI,
      },
    },
  },

  // ─── Global: shared plugins + rules ─────────────────────────────────────────
  {
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: {
      perfectionist,
      "@stylistic": stylistic,
      vortex: {
        rules: {
          "no-bluebird-promise-alias": noBluebirdPromiseAliasRule,
          "no-bluebird-resolve-promiselike": noBluebirdResolveWithPromiseLike,
          "no-restricted-imports-errors": noRestrictedImportsRule,
          "no-restricted-imports-warnings": noRestrictedImportsRule,
        },
      },
    },
    rules: {
      // Perfectionist
      "perfectionist/sort-imports": "warn",
      "perfectionist/sort-exports": "warn",

      // Stylistic
      "@stylistic/jsx-newline": ["warn", { prevent: false }],
      "@stylistic/jsx-self-closing-comp": "warn",

      // Vortex custom rules
      "vortex/no-bluebird-promise-alias": "error",
      "vortex/no-bluebird-resolve-promiselike": "warn",
      "vortex/no-restricted-imports-errors": [
        "error",
        {
          restrictions: [
            {
              name: "process",
              message:
                "process is a Node.js global variable and shouldn't be imported like a module",
            },
            {
              name: "node:process",
              message:
                "process is a Node.js global variable and shouldn't be imported like a module",
            },
          ],
        },
      ],
      "vortex/no-restricted-imports-warnings": [
        "warn",
        {
          restrictions: [
            {
              name: "bluebird",
              message: "Please avoid using Bluebird. Use ES6 promises instead",
            },
          ],
        },
      ],

      // Migrating Webpack to Vite
      "@typescript-eslint/consistent-type-imports": "error",

      // Legacy rules (warnings until fixed, then promote to errors one by one)
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-array-constructor": "warn",
      "@typescript-eslint/no-array-delete": "warn",
      "@typescript-eslint/no-duplicate-type-constituents": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-for-in-array": "warn",
      "@typescript-eslint/no-misused-new": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-redundant-type-constituents": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "@typescript-eslint/only-throw-error": "warn",
      "@typescript-eslint/prefer-namespace-keyword": "warn",
      "@typescript-eslint/prefer-promise-reject-errors": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/restrict-plus-operands": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
      "@typescript-eslint/unbound-method": "warn",
      "no-case-declarations": "warn",
      "no-empty": "warn",
      "no-extra-boolean-cast": "warn",
      "no-global-assign": "warn",
      "no-prototype-builtins": "warn",
      "no-useless-catch": "warn",
      "no-useless-escape": "warn",
      "no-var": "warn",
      "prefer-const": "warn",
      "prefer-rest-params": "warn",
      "prefer-spread": "warn",
    },
  },

  {
    name: "Renderer",
    files: ["src/renderer/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: {
      // TODO: remove Node globals after removing nodeIntegration
      globals: { ...globals.browser, ...globals.node },
    },
    extends: [
      eslintReact.configs["recommended-typescript"],
      betterTailwindcss.configs.recommended,
    ],
    settings: {
      "react-x": {
        version: "16",
      },
      "better-tailwindcss": {
        entryPoint: "src/stylesheets/tailwind-v4.css",
        callees: [
          ["joinClasses", [{ match: "strings" }]],
          ["joinClasses", [{ match: "objectKeys" }]],
        ],
      },
    },
    rules: {
      // React
      "@eslint-react/jsx-shorthand-boolean": ["warn", -1],
      "@eslint-react/no-useless-fragment": "warn",

      // Tailwind
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-unknown-classes": "off",

      // Perfectionist: JSX props sorting (renderer-only, no JSX elsewhere)
      "perfectionist/sort-jsx-props": [
        "warn",
        {
          type: "alphabetical",
          groups: ["shorthand-prop", "unknown", "callback"],
          customGroups: [
            { groupName: "callback", elementNamePattern: "^on.+" },
          ],
        },
      ],

      // Legacy React rules
      "@eslint-react/dom/no-find-dom-node": "warn",
      "@eslint-react/dom/no-void-elements-with-children": "warn",
      "@eslint-react/no-access-state-in-setstate": "warn",
      "@eslint-react/no-class-component": "warn",
      "@eslint-react/no-create-ref": "warn",
      "@eslint-react/no-direct-mutation-state": "warn",
      "@eslint-react/no-missing-key": "warn",
    },
  },

  // ─── src/shared ──────────────────────────────────────────────────────────────
  {
    name: "Shared",
    files: ["src/shared/src/**/*.{ts,mjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^node:",
              message:
                "Node.js built-ins are not allowed in the shared package. This package must be platform-agnostic.",
            },
            {
              regex: "^electron(/|$)",
              message:
                "Electron is not allowed in the shared package. This package must be platform-agnostic.",
            },
          ],
          paths: [
            ...builtinModules.map((name) => ({
              name,
              message: `'${name}' is a Node.js built-in and is not allowed in the shared package. This package must be platform-agnostic.`,
            })),
          ],
        },
      ],
    },
  },

  {
    name: "Main",
    files: ["src/main/**/*.{ts,js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]);
