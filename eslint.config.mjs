import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";

export default defineConfig([
  {
    // NOTE(erri120): exclude build output and tests as well as any submodules
    ignores: ["out/**", "__tests__", "__mocks__", "extensions/**", "api/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  {
    // NOTE(erri120): use flat['jsx-runtime'] for React 17+
    ...pluginReact.configs.flat.recommended,
    settings: {
      react: {
        version: "16",
      },
    },
  },
  prettierConfig,
  {
    // NOTE(erri120): This legacy config only exists "temporarily" (we'll see how true that holds)
    name: "Vortex legacy config",
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          name: "bluebird",
          message: "Please avoid using Bluebird. Use ES6 promises instead",
        },
      ],
      // NOTE(erri120): These rules were errors by default but got turned into warnings until we fix the code
      // To get the codebase up to stuff, we want all of these warnings to go back to being errors.
      // How to do that:
      // 1) Pick one of these rules and remove it
      // 2) Fix all errors
      // 3) Repeat until there are no rules left
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-array-constructor": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "@typescript-eslint/prefer-namespace-keyword": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
      "no-async-promise-executor": "warn",
      "no-case-declarations": "warn",
      "no-cond-assign": "warn",
      "no-constant-binary-expression": "warn",
      "no-constant-condition": "warn",
      "no-empty": "warn",
      "no-ex-assign": "warn",
      "no-extra-boolean-cast": "warn",
      "no-fallthrough": "warn",
      "no-global-assign": "warn",
      "no-irregular-whitespace": "warn",
      "no-misleading-character-class": "warn",
      "no-prototype-builtins": "warn",
      "no-redeclare": "warn",
      "no-setter-return": "warn",
      "no-sparse-arrays": "warn",
      "no-unreachable": "warn",
      "no-unsafe-optional-chaining": "warn",
      "no-useless-catch": "warn",
      "no-useless-escape": "warn",
      "no-var": "warn",
      "prefer-const": "warn",
      "prefer-rest-params": "warn",
      "prefer-spread": "warn",
      "react/display-name": "warn",
      "react/jsx-key": "warn",
      "react/jsx-no-comment-textnodes": "warn",
      "react/no-direct-mutation-state": "warn",
      "react/no-find-dom-node": "warn",
      "react/no-unescaped-entities": "warn",
      "react/prop-types": "warn",
      "require-yield": "warn",
      "valid-typeof": "warn",
    },
  },
]);
