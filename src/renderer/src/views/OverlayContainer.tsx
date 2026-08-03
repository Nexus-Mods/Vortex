import React, { type FC } from "react";

import ErrorBoundary from "../controls/ErrorBoundary";
import ExtensionGate from "../controls/ExtensionGate";
import { useExtensionObjects } from "../ExtensionProvider";
import type { PropsCallback } from "../types/IExtensionContext";

interface IExtOverlay {
  id: string;
  component: React.ComponentType<React.PropsWithChildren<unknown>>;
  props?: PropsCallback;
}

const registerOverlay = (
  _instanceGroup: undefined,
  id: string,
  component: React.ComponentType<React.PropsWithChildren<unknown>>,
  props?: PropsCallback,
): IExtOverlay => {
  return { id, component, props };
};

const renderOverlay: FC<React.PropsWithChildren<IExtOverlay>> = (overlay) => {
  const props = overlay.props ? overlay.props() : {};
  return (
    <ErrorBoundary className="errorboundary-overlay" key={overlay.id}>
      <ExtensionGate id={overlay.id}>
        <overlay.component {...props} />
      </ExtensionGate>
    </ErrorBoundary>
  );
};

export const OverlayContainer: FC<React.PropsWithChildren<unknown>> = () => {
  const overlays = useExtensionObjects<IExtOverlay>(registerOverlay);

  return <div>{overlays.map((overlay) => renderOverlay(overlay))}</div>;
};

export default OverlayContainer;
