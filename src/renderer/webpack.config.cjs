const path = require("node:path");
const createConfig = require("../../webpack.base.cjs");

const config = createConfig(
    {
        renderer: path.resolve(__dirname, "src", "renderer.tsx"),
        splash: path.resolve(__dirname, "src", "splash.ts"),
    },
    "electron-renderer",
    path.resolve(__dirname, "tsconfig.json"),
);

module.exports = config;
