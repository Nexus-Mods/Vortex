import React from "react";
import { Trans } from "react-i18next";
import { useSelector } from "react-redux";

import { shouldShowPremiumAd } from "@/extensions/nexus_integration/selectors";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { opn } from "@/util/api";
import { Campaign, Content, Section, nexusModsURL } from "@/util/util";

import { PREMIUM_PATH } from "../../../nexus_integration/constants";

export const PremiumBanner = () => {
  const showPremiumAd = useSelector(shouldShowPremiumAd);

  if (!showPremiumAd) {
    return null;
  }

  return (
    <div className="flex items-center gap-x-2 rounded-lg border border-stroke-weak p-3">
      <PremiumBadge />

      <Typography isTranslucent={true}>
        <Trans
          components={{
            premiumLink: (
              <TypographyLink
                typographyType="inherit"
                onClick={() => {
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
