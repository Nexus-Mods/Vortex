import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import { useSelector } from "react-redux";

import { shouldShowPremiumAd } from "@/extensions/nexus_integration/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { opn } from "@/util/api";
import { Campaign, Content, Section, nexusModsURL } from "@/util/util";

import { PREMIUM_PATH } from "../../../nexus_integration/constants";
import { useHealthCheckTracking } from "../../hooks/useHealthCheckTracking";
import type { CheckName } from "../../utils/shared/tracking";

/** Where the premium banner is shown. */
export type BannerPlacement = "list" | "detail";

/** Analytics context for the premium upsell banner. */
export interface IPremiumBannerTracking {
  api: IExtensionApi;
  placement: BannerPlacement;
  totalIssues: number;
  /** The issue in view, on a detail page. Both absent on the cross-check listing. */
  issueId?: string;
  checkId?: CheckName;
}

export const PremiumBanner = ({ tracking }: { tracking: IPremiumBannerTracking }) => {
  const { api, placement, totalIssues, issueId, checkId } = tracking;
  const showPremiumAd = useSelector(shouldShowPremiumAd);
  const { trackPremiumBannerShown, trackPremiumBannerClicked } = useHealthCheckTracking(api);

  useEffect(() => {
    if (showPremiumAd) {
      trackPremiumBannerShown({
        placement,
        total_issues: totalIssues,
        issue_id: issueId,
        check_id: checkId,
      });
    }
  }, [showPremiumAd, placement, totalIssues, issueId, checkId, trackPremiumBannerShown]);

  if (!showPremiumAd) {
    return null;
  }

  return (
    <div className="flex items-center gap-x-2 rounded-lg border border-stroke-weak p-3">
      <PremiumBadge />

      <Typography appearance="moderate" brand="neutral-translucent">
        <Trans
          components={{
            premiumLink: (
              <TypographyLink
                brand="neutral-translucent"
                typographyType="inherit"
                onClick={() => {
                  trackPremiumBannerClicked({
                    placement,
                    total_issues: totalIssues,
                    issue_id: issueId,
                    check_id: checkId,
                  });

                  opn(
                    nexusModsURL(PREMIUM_PATH, {
                      section: Section.Users,
                      campaign: Campaign.BuyPremium,
                      content: Content.HealthCheckAd,
                    }),
                  ).catch(() => undefined);
                }}
              />
            ),
          }}
          i18nKey="listing::premium_banner::description"
          ns="health_check"
        />
      </Typography>
    </div>
  );
};
