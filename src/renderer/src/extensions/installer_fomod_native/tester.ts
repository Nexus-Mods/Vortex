import type {
  ISupportedResult,
  ITestSupportedDetails,
} from "../mod_management/types/TestSupported";

import { VortexModTester } from "./utils/VortexModTester";

let testerInstance: VortexModTester | null = null;

/**
 * Test if files are supported by the FOMOD installer
 */
export const testSupported = async (
  files: string[],
  details: ITestSupportedDetails | undefined,
  isBasic: boolean,
): Promise<ISupportedResult> => {
  if (!isBasic && details && details.hasXmlConfigXML === false) {
    return {
      supported: false,
      requiredFiles: [],
    };
  }

  if (testerInstance === null) {
    testerInstance = new VortexModTester();
  }

  const result = testerInstance.testSupport(
    files,
    isBasic ? ["Basic"] : ["XmlScript"],
  );
  return Promise.resolve(result);
};
