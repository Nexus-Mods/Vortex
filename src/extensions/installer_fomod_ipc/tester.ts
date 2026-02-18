import { VortexIPCConnection } from "./utils/VortexIPCConnection";
import { createConnectionStrategies } from "./utils/connectionStrategy";
import type { ITestSupportedDetails } from "../mod_management/types/TestSupported";
import { log } from "../../renderer/util/log";
import type { IExtensionApi, ISupportedResult } from "../../renderer/types/api";

/**
 * Test if files are supported by the FOMOD installer
 */
export const testSupported = async (
  api: IExtensionApi,
  files: string[],
  gameId: string,
  details?: ITestSupportedDetails,
): Promise<ISupportedResult> => {
  if (!["oblivion", "fallout3", "falloutnv"].includes(gameId)) {
    return {
      supported: false,
      requiredFiles: [],
    };
  }

  if (details && details.hasCSScripts === false) {
    return {
      supported: false,
      requiredFiles: [],
    };
  }

  let connection: VortexIPCConnection | null = null;

  try {
    const strategies = createConnectionStrategies();
    connection = new VortexIPCConnection(api, strategies, 10000);
    await connection.initialize();

    const result = await connection.testSupported(files, ["CSharpScript"]);

    log("debug", "FOMOD testSupported result", {
      supported: result.supported,
      requiredFiles: result.requiredFiles,
      gameId,
    });

    return result;
  } catch (err: any) {
    const errorName = err.name || "Error";
    log("error", "FOMOD testSupported failed", {
      errorName,
      error: err.message,
      gameId,
    });

    return {
      supported: false,
      requiredFiles: [],
    };
  } finally {
    if (connection) {
      await connection.dispose();
    }
  }
};
