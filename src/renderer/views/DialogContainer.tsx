import React, { type FC } from "react";

import type { PropsCallbackTyped } from "../../types/IExtensionContext";

import ErrorBoundary, {
  type IBaseProps as IErrorBoundaryProps,
} from "../controls/ErrorBoundary";
import ExtensionGate from "../controls/ExtensionGate";
import { useExtensionObjects } from "../ExtensionProvider";

export interface IBaseProps {
  visibleDialog: string;
  onHideDialog: () => void;
}

interface IExtDialog {
  id: string;
  component: React.ComponentType<IErrorBoundaryProps>;
  props: PropsCallbackTyped<IErrorBoundaryProps>;
}

const registerDialog = (
  _instanceGroup: undefined,
  id: string,
  component: React.ComponentType<IErrorBoundaryProps>,
  props?: PropsCallbackTyped<IErrorBoundaryProps>,
): IExtDialog => {
  return { id, component, props };
};

interface IRenderDialogProps {
  dialog: IExtDialog;
  visibleDialog: string;
  onHideDialog: () => void;
}

const RenderDialog: FC<IRenderDialogProps> = ({
  dialog,
  visibleDialog,
  onHideDialog,
}): React.JSX.Element => {
  const props = dialog.props !== undefined ? dialog.props() : {};
  return (
    <ErrorBoundary
      canDisplayError={false}
      className="errorboundary-dialog"
      key={dialog.id}
      visible={dialog.id === visibleDialog}
      onHide={onHideDialog}
    >
      <ExtensionGate id={dialog.id}>
        <dialog.component
          visible={dialog.id === visibleDialog}
          onHide={onHideDialog}
          {...props}
        />
      </ExtensionGate>
    </ErrorBoundary>
  );
};

export const DialogContainer: React.FC<IBaseProps> = ({
  visibleDialog,
  onHideDialog,
}) => {
  const dialogs = useExtensionObjects<IExtDialog>(registerDialog);

  return (
    <div id="dialog-container">
      {dialogs.map((dialog) =>
        RenderDialog({ dialog, visibleDialog, onHideDialog }),
      )}
    </div>
  );
};

export default DialogContainer;
