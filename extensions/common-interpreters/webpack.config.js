let webpack = require("vortex-api/bin/webpack").default;

module.exports = webpack("common-interpreters", __dirname, 5);
