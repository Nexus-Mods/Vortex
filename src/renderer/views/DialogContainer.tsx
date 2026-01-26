import ErrorBoundary from "../controls/ErrorBoundary";
import ExtensionGate from "../controls/ExtensionGate";
import type { PropsCallback } from "../../types/IExtensionContext";
import { useExtensionObjects } from "../../util/ExtensionProvider";

import * as React from "react";

interface IExtDialog {
  id: string;
  component: React.ComponentType;
  props: PropsCallback;
}

export interface IBaseProps {
  visibleDialog: string;
  onHideDialog: () => void;
}

function registerDialog(
  _instanceGroup: undefined,
  id: string,
  component: React.ComponentClass,
  props?: PropsCallback,
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
      key={dialog.id}
      className="errorboundary-dialog"
      canDisplayError={false}
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
