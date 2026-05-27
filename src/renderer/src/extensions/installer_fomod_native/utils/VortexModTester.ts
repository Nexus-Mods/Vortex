import type * as fomodT from "@nexusmods/fomod-installer-native";

import { log } from "@/logging";
import type { ISupportedResult } from "@/types/api";

export class VortexModTester {
  readonly #fomod: typeof fomodT;

  static async create(): Promise<VortexModTester | null> {
    try {
      const nativeModule = await import("@nexusmods/fomod-installer-native");
      return new VortexModTester(nativeModule);
    } catch (err) {
      log("error", "Failed to load native FOMOD module", err);
      return null;
    }
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
