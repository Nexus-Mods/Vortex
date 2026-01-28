const webpack = require("vortex-api/bin/webpack").default;

const config = webpack("modpacks", __dirname, 5);
config.externals["./build/Release/bsdiff.node"] = "./bsdiff.node";

module.exports = config;
