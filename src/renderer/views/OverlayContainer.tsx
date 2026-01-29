import * as React from "react";

import type { PropsCallback } from "../../types/IExtensionContext";

import { useExtensionObjects } from "../../util/ExtensionProvider";
import ErrorBoundary from "../controls/ErrorBoundary";
import ExtensionGate from "../controls/ExtensionGate";

interface IExtOverlay {
  id: string;
  component: React.ComponentType;
  props?: PropsCallback;
}

function registerOverlay(
  _instanceGroup: undefined,
  id: string,
  component: React.ComponentType,
  props?: PropsCallback,
): IExtOverlay {
  return { id, component, props };
}

function renderOverlay(overlay: IExtOverlay): React.JSX.Element {
  const props = overlay.props ? overlay.props() : {};
  return (
    <ErrorBoundary className="errorboundary-overlay" key={overlay.id}>
      <ExtensionGate id={overlay.id}>
        <overlay.component {...props} />
      </ExtensionGate>
    </ErrorBoundary>
  );
}

export const OverlayContainer: React.FC = () => {
  const objects = useExtensionObjects<IExtOverlay>(registerOverlay);

  return <div>{objects.map((overlay) => renderOverlay(overlay))}</div>;
};

export default OverlayContainer;
