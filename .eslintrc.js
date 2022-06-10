module.exports = {
    "env": {
        "browser": true,
        "es2021": true,
        "node": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaFeatures": {
            "jsx": true
        },
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "plugins": [
        "react",
        "@typescript-eslint"
    ],
    "rules": {
      // If you are reading this your are probably wondering why we got so many warnings
      // To put it simple, we used TSLint, and when we moved to ESLint we did not want to
      // to auto fix all the errors, so now these are warning and we fix them only when we touch 
      // the files with warning
      "no-unexpected-multiline": "warn",
      "no-extra-boolean-cast": "warn",
      "prefer-const": "warn",
      "no-async-promise-executor": "warn",
      "no-var": "warn",
      "no-useless-escape": "warn",
      "no-empty": "warn",
      "no-empty-pattern": "warn",
  
      // I'd like this one as an error again once solved
      "no-irregular-whitespace": "warn",
      // I'd like this one as an error again once solved
      "no-constant-condition": "warn",

      // I'm not sure about this one, maybe we should just disable this rule entirelly
      "prefer-spread": "warn", 

      "@typescript-eslint/prefer-as-const": "warn",
      "@typescript-eslint/no-extra-semi": "warn",
      "@typescript-eslint/no-inferrable-types": "warn",
      "@typescript-eslint/no-var-requires": "warn",

      // I'd like this one as an error again once solved
      "@typescript-eslint/ban-ts-comment": "warn",
      "react/prop-types": "warn",
      "react/display-name": "warn",
      "react/jsx-no-comment-textnodes": "warn",

      // One of the few rules I'm quite happy to just disable entirelly -> https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unescaped-entities.md
      "react/no-unescaped-entities": "warn",

      // This needs to be turned back into an error after we remove all the remaning instances of it
      "react/no-find-dom-node": "warn",

      // This needs to be turned back into an error after we remove all the remaning instances of it
      "react/jsx-key": "warn",

      // Note: Check https://typescript-eslint.io/rules/ban-types/#extenddefaults
      // This can be handy to mark deprecated types
      "@typescript-eslint/ban-types": "warn", 
  
      // You can use types instead of interface for this cases eg:
      // NO! : interface IAttribute extends IXmlNode<{ id: string, type: string, value: string }> {}
      // YES!: type IAttribute = IXmlNode<{ id: string, type: string, value: string }>;
      "@typescript-eslint/no-empty-interface": "warn",

      // Yes, use use IInterfaceNameHere
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          "selector": "interface",
          "format": ["PascalCase"],
          "custom": {
            "regex": "^I[A-Z]",
            "match": true
          }
        }
      ]
    },
}
