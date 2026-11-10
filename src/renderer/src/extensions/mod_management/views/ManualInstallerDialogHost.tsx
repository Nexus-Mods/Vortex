import type { VortexModStagingFolder } from "@vortex/shared";
import React from "react";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";

import { modNameByStagingFolder } from "../selectors";
import { ManualInstallerDialog, type IManualInstallerDialogProps } from "./ManualInstallerDialog";

const NO_MOD_NAMES: ReadonlyMap<VortexModStagingFolder, string> = new Map();

/**
 * Shows the first pending request. The dialog container only calls a dialog's props callback when
 * its visible dialog changes, which it doesn't between requests answered one after the other. So
 * the request is read from the state here, otherwise the dialog keeps showing (and answering) a
 * request that is already done.
 */
export const ManualInstallerDialogHost = (
  props: Omit<IManualInstallerDialogProps, "request" | "modNames">,
) => {
  const request = useSelector((state: IState) => state.session.manualInstaller.pending[0]);
  const modNames = useSelector((state: IState) =>
    request === undefined ? NO_MOD_NAMES : modNameByStagingFolder(state, request.gameId),
  );

  return <ManualInstallerDialog {...props} modNames={modNames} request={request} />;
};
