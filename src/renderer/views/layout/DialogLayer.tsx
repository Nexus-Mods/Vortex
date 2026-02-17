import React, { useCallback, type FC } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../types/IState";

import { setDialogVisible } from "../../actions/session";
import { Dialog } from "../Dialog";
import { DialogContainer } from "../DialogContainer";
import { OverlayContainer } from "../OverlayContainer";

/**
 * Provides a dialog system layer.
 * For both layouts.
 */
export const DialogLayer: FC = (): JSX.Element => {
  const dispatch = useDispatch();

  const visibleDialog = useSelector(
    (state: IState) => state.session.base.visibleDialog || undefined,
  );

  const onHideDialog = useCallback(() => {
    dispatch(setDialogVisible(undefined));
  }, [dispatch]);

  return (
    <>
      <Dialog />

      <DialogContainer
        visibleDialog={visibleDialog}
        onHideDialog={onHideDialog}
      />

      <OverlayContainer />
    </>
  );
};
