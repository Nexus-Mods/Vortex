let webpack = require("vortex-api/bin/webpack").default;

const exp = webpack("gamebryo-bsa-support", __dirname, 5);

exp.externals["./build/Release/bsatk"] = "./bsatk";

module.exports = exp;
