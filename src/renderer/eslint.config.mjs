import * as path from "node:path";

import eslintReact from "@eslint-react/eslint-plugin";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import perfectionist from "eslint-plugin-perfectionist";
import importPlugin from "eslint-plugin-import";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import noBluebirdPromiseAliasRule from "../../eslint-rules/no-bluebird-promise-alias.mjs";
import noBluebirdResolveWithPromiseLike from "../../eslint-rules/no-bluebird-resolve-promiselike.mjs";
import noRestrictedImportsRule from "../../eslint-rules/no-restricted-imports.mjs";

export default defineConfig([
  {
    ignores: [
      "temp/**",
      "lib/**",
      "dist/**",
      "node_modules/**",

      // TODO: remove old Jest tests and replace with Vitests
      "**/__tests__/**",
      "**/__mocks__/**",
    ],
  },

  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      betterTailwindcss.configs.recommended,
      eslint.configs.recommended,
      eslintReact.configs["recommended-type-checked"],
      prettierConfig,
      tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      // TODO: remove Node globals after disabling nodeIntegration
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      perfectionist,
      "@stylistic": stylistic,
      import: importPlugin,
      vortex: {
        rules: {
          "no-bluebird-promise-alias": noBluebirdPromiseAliasRule,
          "no-bluebird-resolve-promiselike": noBluebirdResolveWithPromiseLike,
          "no-restricted-imports-errors": noRestrictedImportsRule,
          "no-restricted-imports-warnings": noRestrictedImportsRule,
        },
      },
    },
    settings: {
      "react-x": {
        version: "16",
      },
      "better-tailwindcss": {
        entryPoint: "../stylesheets/tailwind-v4.css",
        callees: [
          ["joinClasses", [{ match: "strings" }]],
          ["joinClasses", [{ match: "objectKeys" }]],
        ],
      },
      "import/resolverNext": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: path.resolve(import.meta.dirname, "tsconfig.json"),
        }),
      ],
    },
    rules: {
      // React
      "@eslint-react/jsx-shorthand-boolean": ["warn", -1],
      "@eslint-react/no-useless-fragment": "warn",

      // Tailwind
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-unknown-classes": "off",

      // Perfectionist
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

      // Stylistic
      "@stylistic/jsx-newline": ["warn", { prevent: false }],
      "@stylistic/jsx-self-closing-comp": "warn",

      // Typescript
      "@typescript-eslint/consistent-type-imports": "error",
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

      // Vortex custom rules
      "vortex/no-bluebird-promise-alias": "error",
      "vortex/no-bluebird-resolve-promiselike": "warn", // TODO: change to error
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

      // TODO: to be removed after warnings have been fixed
      "@eslint-react/dom/no-find-dom-node": "warn",
      "@eslint-react/dom/no-void-elements-with-children": "warn",
      "@eslint-react/no-access-state-in-setstate": "warn",
      "@eslint-react/no-class-component": "warn",
      "@eslint-react/no-create-ref": "warn",
      "@eslint-react/no-direct-mutation-state": "warn",
      "@eslint-react/no-leaked-conditional-rendering": "warn",
      "@eslint-react/no-missing-key": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-duplicate-type-constituents": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-redundant-type-constituents": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-enum-comparison": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/only-throw-error": "warn",
      "@typescript-eslint/prefer-promise-reject-errors": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/restrict-plus-operands": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/unbound-method": "warn",
      "no-extra-boolean-cast": "warn",
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
    files: ["*.mjs"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      prettierConfig,
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { perfectionist },
    rules: {
      // Perfectionist
      "perfectionist/sort-imports": "warn",
      "perfectionist/sort-exports": "warn",
    },
  },
]);
