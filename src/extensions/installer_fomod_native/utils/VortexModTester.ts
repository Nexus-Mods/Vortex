import type { ISupportedResult } from "../../../renderer/types/api";
import lazyRequire from "../../../renderer/util/lazyRequire";

import type * as fomodT from "fomod-installer-native";

export class VortexModTester {
  private fomod: typeof fomodT;

  public constructor() {
    this.fomod = lazyRequire<typeof fomodT>(() =>
      require("fomod-installer-native"),
    );
  }
  /**
   * Calls FOMOD's testSupport and converts the result to Vortex data
   */
  public testSupport = (
    files: string[],
    allowedTypes: string[],
  ): ISupportedResult => {
    try {
      const result = this.fomod.NativeModInstaller.testSupported(
        files,
        allowedTypes,
      );
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
