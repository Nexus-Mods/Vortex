/**
 * Vortex Benchmarks Extension
 * Only registers when running in development mode
 */

import type { IExtensionContext } from "@/types/IExtensionContext";

import BenchmarkPage from "./views/BenchmarkPage";

function init(context: IExtensionContext): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  context.registerMainPage("timer", "Benchmarks", BenchmarkPage, {
    priority: 41,
    group: "global",
    menuIcon: "timer",
    newLayout: true,
  });

  return true;
}

export default init;
