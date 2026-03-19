import safeCreateAction from "../../actions/safeCreateAction";

import type { IOverlayOptions, IPosition } from "../../types/api";

export const showOverlay = safeCreateAction(
  "SHOW_INSTRUCTIONS",
  (
    id: string,
    title: string,
    content: string,
    componentId: string,
    pos: IPosition,
    options: IOverlayOptions,
  ) => ({ id, title, content, componentId, pos, options }),
);

export const dismissOverlay = safeCreateAction(
  "DISMISS_INSTRUCTIONS",
  (id: string) => id,
);
