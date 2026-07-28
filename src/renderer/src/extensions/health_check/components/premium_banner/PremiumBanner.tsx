import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import { useSelector } from "react-redux";

import { shouldShowPremiumAd } from "@/extensions/nexus_integration/selectors";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { opn } from "@/util/api";
import { Campaign, Content, Section, nexusModsURL } from "@/util/util";

import { PREMIUM_PATH } from "../../../nexus_integration/constants";
import { useOptionalIssue, useTracker } from "../../hooks/HealthCheckTracking.context";

/** Where the premium banner is shown. */
export type BannerPlacement = "list" | "detail";

export const PremiumBanner = ({
  placement,
  totalIssues,
}: {
  placement: BannerPlacement;
  totalIssues: number;
}) => {
  const showPremiumAd = useSelector(shouldShowPremiumAd);
  const { trackPremiumBannerShown, trackPremiumBannerClicked } = useTracker();
  // Present on a detail page, absent on the cross-check listing.
  const identity = useOptionalIssue()?.identity;

  useEffect(() => {
    if (showPremiumAd) {
      trackPremiumBannerShown({ ...identity, placement, total_issues: totalIssues });
    }
  }, [showPremiumAd, placement, totalIssues, identity, trackPremiumBannerShown]);

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
                  trackPremiumBannerClicked({ ...identity, placement, total_issues: totalIssues });

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
