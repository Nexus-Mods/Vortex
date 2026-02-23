/** @type {import("jest").Config */
const config = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.renderer.json" }],
    "^.+\\.(js|jsx)$": "babel-jest",
  },
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.renderer.json",
    },
  },
  moduleNameMapper: {
    "^cheerio$": "<rootDir>/__mocks__/cheerio.js",
    "^cheerio/lib/utils$": "<rootDir>/__mocks__/cheerio-utils.js",
    "^shortid$": "<rootDir>/__mocks__/shortid.js",
    "^../util/ComponentEx$": "<rootDir>/__mocks__/ComponentEx.js",
  },
  testRegex: "(/__tests__/.*|\\.(test|spec))\\.(js|jsx|ts|tsx)$",
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/out/",
    "/playwright/",
    "<rootDir>/app/",
    "<rootDir>/extensions/fomod-installer/",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/out/",
    "<rootDir>/dist/",
    "<rootDir>/app/",
    "<rootDir>/extensions/fomod-installer/",
    "<rootDir>/node_modules/fomod-installer-ipc/",
    "<rootDir>/node_modules/fomod-installer-native/",
  ],
  moduleFileExtensions: ["js", "json", "jsx", "ts", "tsx", "node"],
  setupFilesAfterEnv: ["<rootDir>setupTests.js"],
};

export default config;
