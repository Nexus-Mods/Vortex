const path = require("node:path");
const createConfig = require("../../webpack.base.cjs");

const config = createConfig(
    {
        main: path.resolve(__dirname, "main.ts"),
    },
    "electron-main",
    path.resolve(__dirname, "tsconfig.json"),
);

module.exports = config;
