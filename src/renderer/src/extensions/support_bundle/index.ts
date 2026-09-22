import type { IExtensionContext } from "../../types/IExtensionContext";
import { SupportBundleDialog } from "./views/SupportBundleDialog";

function init(context: IExtensionContext): boolean {
  context.registerDialog("support-bundle-dialog", SupportBundleDialog);

  return true;
}

export default init;
