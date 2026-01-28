import * as path from "path";
import { types } from "vortex-api";

import ExtensionsDashlet from "./ExtensionsDashlet";

function init(context: types.IExtensionContext): boolean {
  context.registerDashlet(
    "Extensions",
    1,
    4,
    100,
    ExtensionsDashlet,
    () => true,
    () => ({}),
    {
      closable: true,
      fixed: false,
    },
  );

  context.once(() => {
    context.api.setStylesheet(
      "extensions-dashlet",
      path.join(__dirname, "extensions-dashlet.scss"),
    );
  });

  return true;
}

export default init;
