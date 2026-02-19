import { mdiDiamondStone } from "@mdi/js";
import React, { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { PREMIUM_PATH } from "../../../../extensions/nexus_integration/constants";
import { Button } from "../../../tailwind/components/next/button";
import { Typography } from "../../../tailwind/components/next/typography";
import opn from "../../../util/opn";
import { isPremium as isPremiumSelector } from "../../../util/selectors";
import { Campaign, Content, nexusModsURL, Section } from "../../../util/util";

export const PremiumIndicator: FC = () => {
  const { t } = useTranslation();

  const isPremium = useSelector(isPremiumSelector);

  const handleGoPremium = useCallback(() => {
    opn(
      nexusModsURL(PREMIUM_PATH, {
        section: Section.Users,
        campaign: Campaign.BuyPremium,
        content: Content.HeaderAd,
      }),
    ).catch(() => undefined);
  }, []);

  if (isPremium) {
    return (
      <Typography
        appearance="moderate"
        className="leading-5"
        typographyType="title-sm"
      >
        {t("Premium")}
      </Typography>
    );
  }

  return (
    <Button
      buttonType="premium"
      leftIconPath={mdiDiamondStone}
      size="sm"
      onClick={handleGoPremium}
    >
      {t("Go premium")}
    </Button>
  );
};
