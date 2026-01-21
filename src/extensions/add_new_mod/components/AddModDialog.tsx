import React, { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";

import { AddModModal } from "./AddModModal";
import { showAddModDialog } from "../actions/session";
import { createNewMod } from "../util/createMod";
import type { IExtensionApi } from "../../../types/IExtensionContext";

interface IConnectedState {
  showDialog: boolean;
}

interface AddModDialogProps {
  api: IExtensionApi;
}

/**
 * Redux-connected wrapper for AddModModal
 * Used with registerDialog to integrate with Vortex's dialog system
 */
const AddModDialog = ({ api }: AddModDialogProps) => {
  const dispatch = useDispatch();
  const showDialog = useSelector(
    (state: any) => state.session?.addNewMod?.showDialog ?? false,
  );

  const handleClose = useCallback(() => {
    dispatch(showAddModDialog(false));
  }, [dispatch]);

  const handleConfirm = useCallback(
    async (modName: string) => {
      await createNewMod(api, modName);
    },
    [api],
  );

  return (
    <AddModModal
      isOpen={showDialog}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );
};

export default AddModDialog;
