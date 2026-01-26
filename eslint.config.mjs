import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

import noBluebirdPromiseAliasRule from "./eslint-rules/no-bluebird-promise-alias.mjs";
import noCrossImportsRule from "./eslint-rules/no-cross-imports.mjs";

const isCI = !!process.env.CI;
const tseslintConfig = isCI
  ? tseslint.configs.recommended
  : tseslint.configs.recommendedTypeChecked;

export default defineConfig([
  {
    // NOTE(erri120): exclude build output and tests as well as any submodules
    ignores: [
      "out/**",
      "dist/**",
      "app/**",
      "__tests__",
      "__mocks__",
      "extensions/**",
      "api/**",
    ],
  },

  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
  },

  eslint.configs.recommended,
  tseslintConfig,
  eslintReact.configs["recommended-typescript"],
  prettierConfig,

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
    },
  },

  {
    name: "Vortex custom rules",
    plugins: {
      vortex: {
        rules: {
          "no-cross-imports": noCrossImportsRule,
          "no-bluebird-promise-alias": noBluebirdPromiseAliasRule,
        },
      },
    },
    rules: {
      "vortex/no-cross-imports": "error",
      "vortex/no-bluebird-promise-alias": "error",
    },
  },

  {
    name: "Migrating Webpack to Vite",
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          name: "process",
          message:
            "process is a Node.js global variable and shouldn't be imported like a module",
        },
      ],
    },
  },

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
