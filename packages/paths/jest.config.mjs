/** @type {import("jest").Config} */
const config = {
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  testRegex: "(/__tests__/.*\\.test)\\.ts$",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/__tests__/mocks/"],
  moduleFileExtensions: ["ts", "js", "json"],
};

export default config;
