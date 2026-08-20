import type { IExtensionApi } from "../../types/api";
import { notifyNativeInstallerUnavailable } from "../installer_fomod_shared/utils/nativeAvailability";
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
  api: IExtensionApi,
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
    testerInstance = await VortexModTester.create();
    if (testerInstance === null) {
      // The addon can't be loaded in this process. Say so, because the
      // alternative is a silent walk down to the verbatim-copy `fallback`
      // installer that quietly mis-installs every mod.
      notifyNativeInstallerUnavailable(api);
      return { supported: false, requiredFiles: [] };
    }
  }

  return testerInstance.testSupport(files, isBasic ? ["Basic"] : ["XmlScript"]);
};
