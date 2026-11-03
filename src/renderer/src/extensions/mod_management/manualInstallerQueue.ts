import { setDialogVisible } from "@/actions/session";
import type { IExtensionApi } from "@/types/IExtensionContext";

import {
  dequeueManualInstallerRequest,
  enqueueManualInstallerRequest,
} from "./actions/manualInstaller";
import type { IManualInstallerRequest } from "./reducers/manualInstaller";

export const MANUAL_INSTALLER_DIALOG_ID = "manual-installer-destination";

/** what the user chose in the destination dialog */
export interface IManualInstallerAnswer {
  /** folder, relative to the game root; empty is the game root itself */
  folder: string;
  /** leave out the folder all files of the archive are in */
  skipTopFolder: boolean;
  /** use this folder for future mods of the game */
  useAsDefault: boolean;
  /** don't show the dialog again for this game */
  dontAskAgain: boolean;
  /** use this folder for the rest of the batch */
  useForAll: boolean;
}

// the resolvers can't live in the state, it only holds serializable data
const resolvers = new Map<string, (answer: IManualInstallerAnswer | undefined) => void>();

/**
 * Asks the user for the destination folder of a mod. Requests are answered one at a time in the
 * order they arrive, the dialog always shows the first. Resolves undefined if the user cancelled.
 */
export function requestManualInstallerDestination(
  api: IExtensionApi,
  request: Omit<IManualInstallerRequest, "id">,
): Promise<IManualInstallerAnswer | undefined> {
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    resolvers.set(id, resolve);
    api.store?.dispatch(enqueueManualInstallerRequest({ ...request, id }));
    api.store?.dispatch(setDialogVisible(MANUAL_INSTALLER_DIALOG_ID));
  });
}

/** Answers a request. The dialog can report the same request more than once, only the first counts. */
export function answerManualInstallerRequest(
  api: IExtensionApi,
  requestId: string,
  answer: IManualInstallerAnswer | undefined,
): void {
  const resolve = resolvers.get(requestId);
  if (resolve === undefined) {
    return;
  }
  resolvers.delete(requestId);

  api.store?.dispatch(dequeueManualInstallerRequest(requestId));
  if (api.getState().session.manualInstaller.pending.length === 0) {
    api.store?.dispatch(setDialogVisible(undefined));
  }
  resolve(answer);
}
