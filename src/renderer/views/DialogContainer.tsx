import * as React from "react";

import type { PropsCallbackTyped } from "../../types/IExtensionContext";

import { useExtensionObjects } from "../../util/ExtensionProvider";
import ErrorBoundary, {
  type IBaseProps as IErrorBoundaryProps,
} from "../controls/ErrorBoundary";
import ExtensionGate from "../controls/ExtensionGate";

export interface IBaseProps {
  visibleDialog: string;
  onHideDialog: () => void;
}

interface IExtDialog {
  id: string;
  component: React.ComponentType<IErrorBoundaryProps>;
  props: PropsCallbackTyped<IErrorBoundaryProps>;
}

function registerDialog(
  _instanceGroup: undefined,
  id: string,
  component: React.ComponentType<IErrorBoundaryProps>,
  props?: PropsCallbackTyped<IErrorBoundaryProps>,
): IExtDialog {
  return { id, component, props };
}

function renderDialog(
  dialog: IExtDialog,
  visibleDialog: string,
  onHideDialog: () => void,
): React.JSX.Element {
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
}

export const DialogContainer: React.FC<IBaseProps> = ({
  visibleDialog,
  onHideDialog,
}) => {
  const objects = useExtensionObjects<IExtDialog>(registerDialog);

  return (
    <div id="dialog-container">
      {objects.map((dialog) =>
        renderDialog(dialog, visibleDialog, onHideDialog),
      )}
    </div>
  );
};

export default DialogContainer;
