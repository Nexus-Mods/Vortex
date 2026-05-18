import LazyComponent from "../../controls/LazyComponent";
import type { IExtensionContext } from "../../types/IExtensionContext";
import {} from "./SettingsVortex";

function init(context: IExtensionContext): boolean {
  context.registerSettings(
    "Vortex",
    LazyComponent(() => require("./SettingsVortex")),
    undefined,
    undefined,
    50,
  );

  return true;
}

export default init;
