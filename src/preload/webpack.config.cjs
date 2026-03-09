const path = require("node:path");
const createConfig = require("../../webpack.base.cjs");

const config = createConfig(
    {
        preload: path.resolve(__dirname, "src", "index.ts"),
    },
    "electron-main",
    path.resolve(__dirname, "tsconfig.json"),
);

module.exports = config;
