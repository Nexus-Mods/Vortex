/**
 * Tailwind Development Extension
 * Only registers when running in development mode
 */

import type { IExtensionContext } from "../../types/IExtensionContext";
import TailwindPage from "./views/TailwindPage";

function init(context: IExtensionContext): boolean {
  // Only register this page in development mode
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (!isDevelopment) {
    return false; // Don't initialize in production
  }

  // Register the Tailwind development page
  // Using 'details' icon (same as Knowledge Base) for development content
  context.registerMainPage("details", "Tailwind", TailwindPage, {
    group: "global",
    isClassicOnly: true,
  });

  return true;
}

export default init;
