import { mdiDiamondStone } from "@mdi/js";
import React, { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "../../../../types/IState";

import { PREMIUM_PATH } from "../../../../extensions/nexus_integration/constants";
import { Button } from "../../../../tailwind/components/next/button";
import { Typography } from "../../../../tailwind/components/next/typography";
import { hasNexusPersistent } from "../../../../util/nexusState";
import opn from "../../../../util/opn";
import {
  Campaign,
  Content,
  nexusModsURL,
  Section,
} from "../../../../util/util";

export const PremiumIndicator: FC = () => {
  const { t } = useTranslation();

  const isPremium = useSelector((state: IState) => {
    if (!hasNexusPersistent(state.persistent)) {
      return false;
    }
    return state.persistent.nexus.userInfo?.isPremium ?? false;
  });

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
