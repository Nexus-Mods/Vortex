import { createAction } from "redux-act";

import type { IManualInstallerRequest } from "../reducers/manualInstaller";

/** a mod is waiting for its destination folder; the dialog answers requests in the order they arrive */
export const enqueueManualInstallerRequest = createAction(
  "ENQUEUE_MANUAL_INSTALLER_REQUEST",
  (request: IManualInstallerRequest) => request,
);

/** the request was answered or cancelled */
export const dequeueManualInstallerRequest = createAction(
  "DEQUEUE_MANUAL_INSTALLER_REQUEST",
  (requestId: string) => requestId,
);
