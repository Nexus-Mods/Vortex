import React, { type FC } from "react";

import type { PropsCallback } from "../../types/IExtensionContext";

import { useExtensionObjects } from "../../util/ExtensionProvider";
import ErrorBoundary from "../controls/ErrorBoundary";
import ExtensionGate from "../controls/ExtensionGate";

interface IExtOverlay {
  id: string;
  component: React.ComponentType;
  props?: PropsCallback;
}

const registerOverlay = (
  _instanceGroup: undefined,
  id: string,
  component: React.ComponentType,
  props?: PropsCallback,
): IExtOverlay => {
  return { id, component, props };
};

const renderOverlay: FC<IExtOverlay> = (overlay) => {
  const props = overlay.props ? overlay.props() : {};
  return (
    <ErrorBoundary className="errorboundary-overlay" key={overlay.id}>
      <ExtensionGate id={overlay.id}>
        <overlay.component {...props} />
      </ExtensionGate>
    </ErrorBoundary>
  );
};

export const OverlayContainer: FC = () => {
  const overlays = useExtensionObjects<IExtOverlay>(registerOverlay);

  return <div>{overlays.map((overlay) => renderOverlay(overlay))}</div>;
};

export default OverlayContainer;
