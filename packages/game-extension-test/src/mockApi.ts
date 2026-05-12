import { setReadFileResolver } from "@vortex/extension-test-mocks";
import { vi } from "vitest";

import type { IGameExtensionTestDescriptor, ISyntheticContext } from "./types";
import { lastSegment } from "./util";

export interface IMockApi {
  api: unknown; // IExtensionApi shape; consumed via duck-typing inside extensions
  readFileCalls: { path: string }[];
}

/**
 * Build the mocked IExtensionApi handed to the per-mod healthcheck. Also
 * primes the shared vortex-api mock's readFile resolver so that
 * `fs.readFileAsync` inside the installer reads from synthetic content.
 */
export function buildMockApi(
  descriptor: IGameExtensionTestDescriptor,
  manifest: string[],
  ctx: ISyntheticContext,
): IMockApi {
  const calls: { path: string }[] = [];

  setReadFileResolver(async (absPath: string) => {
    calls.push({ path: absPath });
    const baseName = lastSegment(absPath);
    const generator = descriptor.syntheticContent[baseName];
    if (!generator) return Buffer.alloc(0);
    const out = generator(ctx);
    return typeof out === "string" ? Buffer.from(out, "utf8") : out;
  });

  const api = {
    getState: () => ({
      persistent: { mods: {} },
      settings: { mods: { installPath: {} } },
      session: { base: { activeGameId: descriptor.gameId } },
    }),
    store: { getState: () => ({}), dispatch: vi.fn() },
    onStateChange: vi.fn(),
    showErrorNotification: vi.fn(),
    log: vi.fn(),
    ext: {},
  };

  return { api, readFileCalls: calls };
}
