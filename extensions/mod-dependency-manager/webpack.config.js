let webpack = require("vortex-api/bin/webpack").default;

const config = webpack("mod-dependency-manager", __dirname, 5);

config.externals.turbowalk = "turbowalk";
config.externals["xxhash-addon"] = "xxhash-addon";
config.externals["form-data"] = "form-data";
config.externals["@nexusmods/nexus-api"] = "@nexusmods/nexus-api";
config.externals["iconv-lite"] = "iconv-lite";
config.externals["encoding"] = "encoding";

module.exports = config;
