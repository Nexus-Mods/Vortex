import ErrorBoundary from "../controls/ErrorBoundary";
import type { PropsCallback } from "../../types/IExtensionContext";
import { useExtensionObjects } from "../../util/ExtensionProvider";

import * as React from "react";
import ExtensionGate from "../controls/ExtensionGate";

interface IExtOverlay {
  id: string;
  component: React.ComponentType;
  props: PropsCallback;
}

function registerOverlay(
  instanceGroup: undefined,
  id: string,
  component: React.ComponentClass,
  props?: PropsCallback,
): IExtOverlay {
  return { id, component, props };
}

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

export const OverlayContainer: React.FC = () => {
  const objects = useExtensionObjects<IExtOverlay>(registerOverlay);

  return <div>{objects.map((overlay) => renderOverlay(overlay))}</div>;
};

export default OverlayContainer;
