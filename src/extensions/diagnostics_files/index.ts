import { setDialogVisible } from "../../actions/session";
import type { IExtensionContext } from "../../types/IExtensionContext";

import DiagnosticsFilesDialog from "./views/DiagnosticsFilesDialog";

function init(context: IExtensionContext): boolean {
  context.registerAction(
    "global-icons",
    190,
    "changelog",
    { isClassicOnly: true },
    "View Logs",
    () => {
      context.api.store.dispatch(setDialogVisible("diagnostics-files-dialog"));
    },
  );

  context.registerDialog("diagnostics-files-dialog", DiagnosticsFilesDialog);

  return true;
}

export default init;
