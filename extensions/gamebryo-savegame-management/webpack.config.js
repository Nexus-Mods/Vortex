let webpack = require("vortex-api/bin/webpack").default;

const res = webpack("gamebryo-savegame-management", __dirname, 5);

res.externals["./GamebryoSave"] = "./GamebryoSave";

module.exports = res;
