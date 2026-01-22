import ErrorBoundary from "../controls/ErrorBoundary";
import type { PropsCallback } from "../../types/IExtensionContext";
import { extend } from "../controls/ComponentEx";

import * as React from "react";
import ExtensionGate from "../controls/ExtensionGate";

interface IExtOverlay {
  id: string;
  component: React.ComponentType<any>;
  props: PropsCallback;
}

export interface IBaseProps {}

export interface IExtendedProps {
  objects: IExtOverlay[];
}

type IProps = IBaseProps & IExtendedProps;

function renderOverlay(overlay: IExtOverlay): React.JSX.Element {
  const props = overlay.props !== undefined ? overlay.props() : {};
  return (
    <ErrorBoundary key={overlay.id} className="errorboundary-overlay">
      <ExtensionGate id={overlay.id}>
        <overlay.component {...props} />
      </ExtensionGate>
    </ErrorBoundary>
  );
}

function OverlayContainer(props: IProps): React.JSX.Element {
  const { objects } = props;
  return <div>{objects.map((overlay) => renderOverlay(overlay))}</div>;
}

function registerOverlay(
  instanceGroup: undefined,
  id: string,
  component: React.ComponentClass<any>,
  props?: PropsCallback,
): IExtOverlay {
  return { id, component, props };
}

export default extend(registerOverlay)(
  OverlayContainer,
) as React.ComponentClass<IBaseProps>;
