/**
 * PGlite Development Extension
 * Only registers when running in development mode
 * Provides a SQL REPL for testing and debugging the PGlite database
 */

import type { IExtensionContext } from "../../types/IExtensionContext";
import PGlitePage from "./views/PGlitePage";

function init(context: IExtensionContext): boolean {
  // Only register this page in development mode
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (!isDevelopment) {
    return false; // Don't initialize in production
  }

  // Register the PGlite development page
  // Using 'database' icon for database-related content
  context.registerMainPage("database", "PGlite", PGlitePage, {
    group: "global",
  });

  return true;
}

export default init;
