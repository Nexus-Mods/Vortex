import { useCallback, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { onDownloadRequirement } from "@/extensions/health_check/utils/modRequirements/onDownloadRequirement";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { opn } from "@/util/api";

import { HealthCheckFeedbackEvent } from "../../../analytics/mixpanel/MixpanelEvents";
import { shouldShowPremiumAd } from "../../../nexus_integration/selectors";
import { setFeedbackGiven } from "../../actions/persistent";
import { feedbackGivenMap } from "../../selectors";
import type { IModRequirementExt } from "../../types";

/**
 * Shared action logic for a single mod requirement, used by both the listing row
 * and the detail view: premium-gated 1-click install, thumbs feedback (with
 * analytics + the negative-reason modal), and opening the mod page. Keeps the two
 * call sites behaviourally identical.
 *
 * `onInstalled` runs after a successful install (e.g. navigate back from detail).
 */
export function useModRequirementActions(
  api: IExtensionApi,
  mod: IModRequirementExt,
  onInstalled?: () => void,
) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const feedbackMap = useSelector(feedbackGivenMap);
  const givenFeedback = useMemo(
    () => (feedbackMap[mod.requiredBy.modId] ?? []).includes(mod.id),
    [feedbackMap, mod.requiredBy.modId, mod.id],
  );

  const showPremiumAd = useSelector(shouldShowPremiumAd);

  const openModPage = useCallback(() => {
    if (mod.modUrl) {
      opn(mod.modUrl).catch(() => undefined);
    }
  }, [mod.modUrl]);

  // 1-click install is a Premium feature; free users get the upgrade prompt
  // (which routes them to the mod page) instead of an in-app download.
  const installInApp = useCallback(async () => {
    if (showPremiumAd) {
      setShowPremiumModal(true);
      return;
    }
    await onDownloadRequirement(api, mod);
    onInstalled?.();
  }, [api, mod, showPremiumAd, onInstalled]);

  const handlePositiveFeedback = useCallback(() => {
    api.store?.dispatch(setFeedbackGiven(mod.requiredBy.modId, mod.id));
    api.events.emit(
      "analytics-track-mixpanel-event",
      new HealthCheckFeedbackEvent("positive", mod.gameId, mod.modId, mod.requiredBy.modId),
    );
  }, [api, mod]);

  const handleFeedbackSuccess = useCallback(
    (reasons: string[]) => {
      api.store?.dispatch(setFeedbackGiven(mod.requiredBy.modId, mod.id));
      api.events.emit(
        "analytics-track-mixpanel-event",
        new HealthCheckFeedbackEvent(
          "negative",
          mod.gameId,
          mod.modId,
          mod.requiredBy.modId,
          reasons,
        ),
      );
      setShowFeedbackModal(false);
    },
    [api, mod],
  );

  return {
    givenFeedback,
    showPremiumAd,
    showFeedbackModal,
    setShowFeedbackModal,
    showPremiumModal,
    setShowPremiumModal,
    openModPage,
    installInApp,
    handlePositiveFeedback,
    handleFeedbackSuccess,
  };
}
