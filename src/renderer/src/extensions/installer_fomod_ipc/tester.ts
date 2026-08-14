import { getErrorMessageOrDefault } from "@vortex/shared";

import type { IExtensionApi, ISupportedResult } from "../../types/api";
import { log } from "../../util/log";
import {
  isNativeInstallerAvailable,
  notifyNativeInstallerUnavailable,
} from "../installer_fomod_shared/utils/nativeAvailability";
import type { ITestSupportedDetails } from "../mod_management/types/TestSupported";
import type { TesterMode } from "./utils/allowedTypes";
import { allowedTypesFor } from "./utils/allowedTypes";
import { createConnectionStrategies } from "./utils/connectionStrategy";
import { VortexIPCConnection } from "./utils/VortexIPCConnection";

const unsupported = (): ISupportedResult => ({ supported: false, requiredFiles: [] });

/** Ask the out-of-process installer whether it handles these files. */
const probeSupport = async (
  api: IExtensionApi,
  files: string[],
  gameId: string,
  allowedTypes: string[],
): Promise<ISupportedResult> => {
  let connection: VortexIPCConnection | null = null;

  try {
    connection = new VortexIPCConnection(api, createConnectionStrategies(), 10000);
    await connection.initialize();

    const result = await connection.testSupported(files, allowedTypes);
    log("debug", "FOMOD testSupported result", {
      supported: result.supported,
      requiredFiles: result.requiredFiles,
      allowedTypes,
      gameId,
    });
    return result;
  } catch (err: unknown) {
    log("error", "FOMOD testSupported failed", {
      errorName: err instanceof Error ? err.name : "Error",
      error: getErrorMessageOrDefault(err),
      allowedTypes,
      gameId,
    });
    return unsupported();
  } finally {
    await connection?.dispose();
  }
};

/**
 * Test if files are supported by the FOMOD installer
 */
export const testSupported = async (
  api: IExtensionApi,
  files: string[],
  gameId: string,
  details?: ITestSupportedDetails,
  mode: TesterMode = "scripted",
): Promise<ISupportedResult> => {
  const nativeAvailable = await isNativeInstallerAvailable();
  const allowedTypes = allowedTypesFor(gameId, details, mode, nativeAvailable);
  if (allowedTypes.length === 0) {
    return unsupported();
  }

  if (!nativeAvailable) {
    // Raised from here as well as from the native tester: the native scripted
    // tester short-circuits on `hasXmlConfigXML === false` before it ever tries
    // to load the addon, and once this extension claims basic installs it wins
    // the priority-100 tie (it registers first), so for a plain archive neither
    // native registration gets far enough to raise the warning.
    //
    // Deliberately after the early return, so we only warn once we are actually
    // standing in for the missing addon on this archive.
    notifyNativeInstallerUnavailable(api);
  }

  return probeSupport(api, files, gameId, allowedTypes);
};
