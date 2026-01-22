import ErrorBoundary from "../controls/ErrorBoundary";
import ExtensionGate from "../controls/ExtensionGate";
import type { PropsCallback } from "../../types/IExtensionContext";
import { extend } from "../controls/ComponentEx";

import * as React from "react";

interface IExtDialog {
  id: string;
  component: React.ComponentType<any>;
  props: PropsCallback;
}

export interface IBaseProps {
  visibleDialog: string;
  onHideDialog: () => void;
}

export interface IExtendedProps {
  objects: IExtDialog[];
}

type IProps = IBaseProps & IExtendedProps;

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

function DialogContainer(props: IProps): React.JSX.Element {
  const { objects, onHideDialog, visibleDialog } = props;
  return (
    <div id="dialog-container">
      {objects.map((dialog) =>
        renderDialog(dialog, visibleDialog, onHideDialog),
      )}
    </div>
  );
}

function registerDialog(
  instanceGroup: undefined,
  id: string,
  component: React.ComponentClass<any>,
  props?: PropsCallback,
): IExtDialog {
  return { id, component, props };
}

export default extend(registerDialog)(
  DialogContainer,
) as React.ComponentClass<IBaseProps>;
