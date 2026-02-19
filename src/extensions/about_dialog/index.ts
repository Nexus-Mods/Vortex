import { mdiInformationOutline } from "@mdi/js";
import type { IExtensionContext } from "../../renderer/types/IExtensionContext";

import AboutPage from "./views/AboutPage";

function init(context: IExtensionContext): boolean {
  context.registerAction(
    "global-icons",
    200,
    "about",
    { isClassicOnly: true },
    "About",
    () => {
      context.api.events.emit("show-main-page", "About");
    },
  );

  context.registerMainPage("", "About", AboutPage, {
    group: "hidden",
    mdi: mdiInformationOutline,
  });

  return true;
}

export default init;
