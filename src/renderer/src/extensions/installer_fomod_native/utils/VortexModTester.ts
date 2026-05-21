import type * as fomodT from "@nexusmods/fomod-installer-native";

import type { ISupportedResult } from "../../../types/api";
import lazyRequire from "../../../util/lazyRequire";

export class VortexModTester {
  private fomod: typeof fomodT;

  public constructor() {
    this.fomod = lazyRequire<typeof fomodT>(() => require("@nexusmods/fomod-installer-native"));
  }
  /**
   * Calls FOMOD's testSupport and converts the result to Vortex data
   */
  public testSupport = (files: string[], allowedTypes: string[]): ISupportedResult => {
    try {
      const result = this.fomod.NativeModInstaller.testSupported(files, allowedTypes);
      return {
        supported: result.supported,
        requiredFiles: result.requiredFiles,
      };
    } catch (error) {
      return {
        supported: false,
        requiredFiles: [],
      };
    }
  };
}
