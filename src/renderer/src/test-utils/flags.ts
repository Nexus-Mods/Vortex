import { onTestFinished, vi } from "vitest";

import { FlagService } from "../FlagService";

/** Turns the mod pipeline flag on for the rest of the test. */
export function enableModPipelineFlag(): void {
  const flags = vi.spyOn(FlagService, "instance", "get").mockReturnValue({
    getFlag: (name: string) => (name === "vortex-mod-pipeline" ? { name } : undefined),
  } as unknown as FlagService);
  onTestFinished(() => flags.mockRestore());
}
