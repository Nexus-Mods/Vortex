import type { IExtensionContext } from "../../types/IExtensionContext";

import { setTelemetryEnabled } from "../../../shared/telemetry/setup";
import { getSafe } from "../../util/storeHelper";

function init(context: IExtensionContext): boolean {
  context.once(() => {
    const state = context.api.getState();
    const analyticsEnabled = getSafe<boolean>(
      state,
      ["settings", "analytics", "enabled"],
      false,
    );
    setTelemetryEnabled(analyticsEnabled);

    // Watch for analytics opt-in changes
    context.api.onStateChange(
      ["settings", "analytics", "enabled"],
      (_prev, next) => {
        setTelemetryEnabled(!!next);
      },
    );
  });

  return true;
}

export default init;
