import createAction from "../../../renderer/actions/safeCreateAction";

export const setInstallerSandbox = createAction(
  "SET_INSTALLER_SANDBOX",
  (enabled: boolean) => enabled,
);
