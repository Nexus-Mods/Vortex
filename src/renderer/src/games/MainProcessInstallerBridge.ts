import type { ISerializedInstallerMeta, ISupportedResult } from "@vortex/shared/ipc";
import type { IInstallResult } from "../extensions/mod_management/types/IInstallResult";
import type {
  InstallFunc,
  ProgressDelegate,
  IInstallationDetails,
} from "../extensions/mod_management/types/InstallFunc";

/**
 * Wraps a main-process installer adaptor so it can be passed to `context.registerInstaller`.
 *
 * `testSupported` and `install` are thin IPC forwarders — all logic lives in main.
 */
export class MainProcessInstallerBridge {
  readonly id: string;
  readonly priority: number;

  readonly testSupported: (
    files: string[],
    gameId: string,
    archivePath: string,
    options: unknown,
  ) => Promise<ISupportedResult>;

  readonly install: InstallFunc;

  constructor(meta: ISerializedInstallerMeta) {
    this.id = meta.id;
    this.priority = meta.priority;

    this.testSupported = (files, gameId) =>
      window.api.installerAdaptors.testSupported(meta.id, files, gameId);

    this.install = (
      files: string[],
      destinationPath: string,
      gameId: string,
      _progress: ProgressDelegate,
      _choices?: unknown,
      _unattended?: boolean,
      _archivePath?: string,
      _options?: IInstallationDetails,
    ): Promise<IInstallResult> =>
      window.api.installerAdaptors
        .install(meta.id, files, destinationPath, gameId)
        .then((result) => result as IInstallResult);
  }
}
