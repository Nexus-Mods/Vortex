/**
 * LAZ-1107: an install-dependencies round for a profile that is no longer in the store must not
 * throw synchronously out of the manager (that escaped the event listener and took the renderer
 * down with "Cannot read properties of undefined (reading 'id')"). Driven through the REAL
 * InstallManager via the makeInstallManager harness.
 */
import { describe, expect, vi } from "vitest";

import { makeMod } from "../../test-utils/builders";
import { test as imTest } from "../../test-utils/installManagerTest";
import { ProcessCanceled } from "../../util/CustomErrors";
import { MOD_TYPE } from "../collections/constants";
import type { IProfile } from "../profile_management/types/IProfile";

vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

const GAME = "skyrimse";
const COLLECTION = "col-1";

describe("InstallManager with a missing profile", () => {
  imTest("installDependencies rejects with ProcessCanceled", async ({ makeInstallManager }) => {
    const h = makeInstallManager({
      mods: {
        [GAME]: {
          [COLLECTION]: makeMod({ id: COLLECTION, type: MOD_TYPE, rules: [] }),
        },
      },
    });

    let result: Promise<void>;
    expect(() => {
      result = h.manager.installDependencies(
        h.api,
        undefined as unknown as IProfile,
        GAME,
        COLLECTION,
        true,
        false,
      );
    }).not.toThrow();
    await expect(result!).rejects.toBeInstanceOf(ProcessCanceled);
  });

  imTest("installRecommendations rejects with ProcessCanceled", async ({ makeInstallManager }) => {
    const h = makeInstallManager({
      mods: {
        [GAME]: {
          [COLLECTION]: makeMod({ id: COLLECTION, type: MOD_TYPE, rules: [] }),
        },
      },
    });

    let result: Promise<void>;
    expect(() => {
      result = h.manager.installRecommendations(
        h.api,
        undefined as unknown as IProfile,
        GAME,
        COLLECTION,
      );
    }).not.toThrow();
    await expect(result!).rejects.toBeInstanceOf(ProcessCanceled);
  });
});
