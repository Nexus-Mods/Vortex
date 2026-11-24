import { isAnalyticsEnabled } from "@/extensions/analytics/selectors";
import { hasOAuthLogin } from "@/extensions/nexus_integration/selectors";
import type { IState } from "@/types/IState";

import type { IExtensionContext } from "../../types/IExtensionContext";
import { startFeedbackReplay, stopFeedbackReplay } from "./util/feedbackReplay";
import { FeedbackDialog } from "./views/FeedbackDialog";
import { SupportBundleDialog } from "./views/SupportBundleDialog";

/**
 * Whether the window is recorded for a feedback: only for a user who can send one, which takes a
 * login the feedback service accepts, and who has agreed to share usage data.
 */
export const shouldRecordReplay = (state: IState): boolean =>
  hasOAuthLogin(state) && isAnalyticsEnabled(state);

function init(context: IExtensionContext): boolean {
  context.registerDialog("support-bundle-dialog", SupportBundleDialog);
  context.registerDialog("feedback-dialog", FeedbackDialog);

  // kept from as early as allowed, so a feedback can show the minutes before it was sent
  context.once(() => {
    const update = () => {
      if (shouldRecordReplay(context.api.getState())) {
        void startFeedbackReplay();
      } else {
        stopFeedbackReplay();
      }
    };
    update();
    context.api.onStateChange(["confidential", "account", "nexus"], update);
    context.api.onStateChange(["settings", "analytics", "enabled"], update);
  });

  return true;
}

export default init;
