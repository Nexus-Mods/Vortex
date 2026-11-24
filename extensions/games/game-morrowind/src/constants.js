const { VortexGameId } = require("@nexusmods/vortex-api");

const MORROWIND_ID = VortexGameId("morrowind");
const NATIVE_PLUGINS = ["Bloodmoon.esm", "Morrowind.esm", "Tribunal.esm"];

module.exports = {
  MORROWIND_ID,
  NATIVE_PLUGINS,
};
