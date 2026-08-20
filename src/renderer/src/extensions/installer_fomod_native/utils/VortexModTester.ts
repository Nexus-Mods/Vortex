import type * as fomodT from "@nexusmods/fomod-installer-native";

import { log } from "@/logging";
import type { ISupportedResult } from "@/types/api";

import { loadNativeInstaller } from "../../installer_fomod_shared/utils/nativeAvailability";

export class VortexModTester {
  readonly #fomod: typeof fomodT;

  static async create(): Promise<VortexModTester | null> {
    // The load is probed (and its failure logged) once per session by
    // loadNativeInstaller, which the IPC installer also consults to decide
    // whether it needs to stand in for us.
    const nativeModule = await loadNativeInstaller();
    return nativeModule !== undefined ? new VortexModTester(nativeModule) : null;
  }

  private constructor(fomod: typeof fomodT) {
    this.#fomod = fomod;
  }

  /**
   * Calls FOMOD's testSupport and converts the result to Vortex data
   */
  public testSupport = (files: string[], allowedTypes: string[]): ISupportedResult => {
    try {
      const result = this.#fomod.NativeModInstaller.testSupported(files, allowedTypes);
      return {
        supported: result.supported,
        requiredFiles: result.requiredFiles,
      };
    } catch (err) {
      log("error", "Failed to determine FOMOD installer support", err);
      return {
        supported: false,
        requiredFiles: [],
      };
    }
  };
}
