import { setDialogVisible } from "../../../actions/session";
import type { IState } from "../../../types/IState";
import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dialog } from "../Dialog";
import { DialogContainer } from "../DialogContainer";
import { OverlayContainer } from "../OverlayContainer";

export const DialogLayer = (): JSX.Element => {
  const dispatch = useDispatch();

  const visibleDialog = useSelector(
    (state: IState) => state.session.base.visibleDialog || undefined,
  );

  const onHideDialog = React.useCallback(() => {
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
