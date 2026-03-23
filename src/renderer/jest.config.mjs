/** @type {import("jest").Config */
const config = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.json" }],
    "^.+\\.(js|jsx)$": "babel-jest",
  },
  moduleNameMapper: {
    "^cheerio$": "<rootDir>/src/__mocks__/cheerio.js",
    "^cheerio/lib/utils$": "<rootDir>/src/__mocks__/cheerio-utils.js",
    "^shortid$": "<rootDir>/src/__mocks__/shortid.js",
    "^../util/ComponentEx$": "<rootDir>/src/__mocks__/ComponentEx.js",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testRegex: "(/src/__tests__/.*)\\.(js|jsx|ts|tsx)$",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/out/"],
  modulePathIgnorePatterns: [
    "<rootDir>/out/",
    "<rootDir>/dist/",
    "<rootDir>/temp/",
  ],
  moduleFileExtensions: ["js", "json", "jsx", "ts", "tsx", "node"],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
};

export default config;
