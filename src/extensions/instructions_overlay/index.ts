import { IExtensionContext } from "../../types/IExtensionContext";
import { dismissOverlay, showOverlay } from "./actions";
import Container from "./Container";
import Reducer from "./reducer";

import { IOverlayOptions, IPosition } from "../../types/IState";

const componentRegistry = new Map<string, React.ComponentType<any>>();

function registerOverlayComponent(
  id: string,
  component: React.ComponentType<any>,
): void {
  componentRegistry.set(id, component);
}

function getOverlayComponent(id: string): React.ComponentType<any> | undefined {
  return componentRegistry.get(id);
}

export { getOverlayComponent };

function init(context: IExtensionContext): boolean {
  const onClose = (id: string) => {
    const state = context.api.getState();
    const overlayInfo = state.session.overlays.overlays[id];
    context.api.store.dispatch(dismissOverlay(id));
    context.api.events.emit("did-dismiss-overlay", id, overlayInfo.options?.id);
  };

  // bit of a hack, we're not actually rendering a dialog, the overlays are added via portal, we
  // just need any node that gets rendered
  context.registerOverlay("overlay", Container, () => ({
    onClose,
  }));
  context.registerReducer(["session", "overlays"], Reducer);

  context.registerAPI(
    "showOverlay",
    (
      id: string,
      title: string,
      content: string | React.ComponentType<any>,
      pos: IPosition = undefined,
      options: IOverlayOptions,
    ) => {
      // If content is a React component, register it and use an identifier
      if (typeof content === "function") {
        const componentId = `component-${id}-${Date.now()}`;
        registerOverlayComponent(componentId, content);
        context.api.store.dispatch(
          showOverlay(id, title, undefined, componentId, pos, options),
        );
      } else {
        context.api.store.dispatch(
          showOverlay(id, title, content, undefined, pos, options),
        );
      }
    },
    { minArguments: 3 },
  );

  context.registerAPI(
    "dismissOverlay",
    (id: string) => {
      onClose(id);
    },
    { minArguments: 1 },
  );

  // Expose component registry functions to extensions that need them - not sure if there's a point to this
  //  but it's easy enough to do.
  context.registerAPI("registerOverlayComponent", registerOverlayComponent, {
    minArguments: 2,
  });
  context.registerAPI("getOverlayComponent", getOverlayComponent, {
    minArguments: 1,
  });

  return true;
}

export default init;
