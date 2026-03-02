import eslintReact from "@eslint-react/eslint-plugin";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import noBluebirdPromiseAliasRule from "./eslint-rules/no-bluebird-promise-alias.mjs";
import noBluebirdResolveWithPromiseLike from "./eslint-rules/no-bluebird-resolve-promiselike.mjs";
import noRestrictedImportsRule from "./eslint-rules/no-restricted-imports.mjs";

const isCI = !!process.env.CI;
const tseslintConfig = isCI
  ? tseslint.configs.recommended
  : tseslint.configs.recommendedTypeChecked;

export default defineConfig([
  {
    // NOTE(erri120): exclude build output and tests as well as any submodules
    ignores: [
      "./src/main/out",
      "./src/main/dist",
      "./src/shared/dist",
      "./src/renderer/__tests__",
      "./src/renderer/__mocks__",
      "./extensions",
      "./api",
    ],
  },

  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
  },

  eslint.configs.recommended,
  tseslintConfig,
  eslintReact.configs["recommended-typescript"],
  prettierConfig,
  betterTailwindcss.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: !isCI,
      },
    },
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
  },

  {
    plugins: {
      perfectionist,
    },
    rules: {
      "@eslint-react/jsx-shorthand-boolean": ["warn", -1],
      "@eslint-react/no-useless-fragment": "warn",
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-unknown-classes": "off",
      "perfectionist/sort-imports": "warn",
      "perfectionist/sort-exports": "warn",
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
    },
  },

  // Stylistic rules that complement Prettier without conflicts.
  // These rules support consistent decisions.
  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@stylistic/jsx-newline": ["warn", { prevent: false }],
      "@stylistic/jsx-self-closing-comp": "warn",
    },
  },

  {
    name: "Vortex custom rules",
    plugins: {
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
      "vortex/no-bluebird-promise-alias": "error",
      "vortex/no-bluebird-resolve-promiselike": "warn", // TODO: change to error
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
    },
  },

  {
    name: "Migrating Webpack to Vite",
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },

  {
    name: "Shared package - no platform-specific imports",
    files: ["src/shared/src/**/*.{ts,js,mjs,cjs}"],
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
            // Node.js built-in modules (legacy imports without 'node:' prefix)
            ...[
              "assert",
              "async_hooks",
              "buffer",
              "child_process",
              "cluster",
              "crypto",
              "dgram",
              "diagnostics_channel",
              "dns",
              "domain",
              "events",
              "fs",
              "http",
              "http2",
              "https",
              "inspector",
              "module",
              "net",
              "os",
              "path",
              "perf_hooks",
              "process",
              "querystring",
              "readline",
              "repl",
              "stream",
              "string_decoder",
              "timers",
              "tls",
              "tty",
              "url",
              "util",
              "v8",
              "vm",
              "wasi",
              "worker_threads",
              "zlib",
            ].map((name) => ({
              name,
              message: `'${name}' is a Node.js built-in and is not allowed in the shared package. This package must be platform-agnostic.`,
            })),
          ],
        },
      ],
    },
  },

  {
    // NOTE(erri120): This legacy config only exists "temporarily" (we'll see how true that holds)
    name: "Vortex legacy config",
    rules: {
      // NOTE(erri120): These rules were errors by default but got turned into warnings until we fix the code
      // To get the codebase up to stuff, we want all of these warnings to go back to being errors.
      // How to do that:
      // 1) Pick one of these rules and remove it
      // 2) Fix all errors
      // 3) Repeat until there are no rules left
      "@eslint-react/dom/no-find-dom-node": "warn",
      "@eslint-react/dom/no-void-elements-with-children": "warn",
      "@eslint-react/no-access-state-in-setstate": "warn",
      "@eslint-react/no-class-component": "warn",
      "@eslint-react/no-create-ref": "warn",
      "@eslint-react/no-direct-mutation-state": "warn",
      "@eslint-react/no-missing-key": "warn",
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
]);
