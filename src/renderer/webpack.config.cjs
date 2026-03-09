const path = require("node:path");
const createConfig = require("../../webpack.base.cjs");

const config = createConfig(
    {
        renderer: path.resolve(__dirname, "renderer.tsx"),
        splash: path.resolve(__dirname, "splash.ts"),
    },
    "electron-renderer",
    path.resolve(__dirname, "tsconfig.json"),
);

module.exports = config;
