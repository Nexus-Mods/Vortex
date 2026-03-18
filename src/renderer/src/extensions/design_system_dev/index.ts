/**
 * Design System Development Extension
 * Only registers when running in development mode
 */

import { mdiPalette } from "@mdi/js";

import type { IExtensionContext } from "../../types/IExtensionContext";
import DesignSystemPage from "./views/DesignSystemPage";

function init(context: IExtensionContext): boolean {
  // Only register this page in development mode
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (!isDevelopment) {
    return false; // Don't initialize in production
  }

  // Register the design system development page
  context.registerMainPage("highlight-ui", "Design System", DesignSystemPage, {
    group: "global",
    mdi: mdiPalette,
  });

  return true;
}

export default init;
