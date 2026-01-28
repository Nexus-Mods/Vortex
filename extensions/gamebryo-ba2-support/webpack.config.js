let webpack = require("vortex-api/bin/webpack").default;

const exp = webpack("gamebryo-ba2-support", __dirname, 5);

exp.externals["./build/Release/ba2tk"] = "./ba2tk";

module.exports = exp;
