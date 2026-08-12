import { mdiDiamondStone } from "@mdi/js";
import React, { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { PREMIUM_PATH } from "@/extensions/nexus_integration/constants";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { Campaign, Content, nexusModsURL, Section } from "@/util/util";

import {
  isLoggedIn as isLoggedInSelector,
  isPremium as isPremiumSelector,
  shouldShowPremiumAd,
} from "../../../../extensions/nexus_integration/selectors";
import opn from "../../../../util/opn";
import { useNexusLogin } from "./useNexusLogin.hook";

export const PremiumIndicator: FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation();

  const loggedIn = useSelector(isLoggedInSelector);
  const showAd = useSelector(shouldShowPremiumAd);
  const premium = useSelector(isPremiumSelector);

  const handleLogin = useNexusLogin();

  const handleGoPremium = useCallback(() => {
    opn(
      nexusModsURL(PREMIUM_PATH, {
        section: Section.Users,
        campaign: Campaign.BuyPremium,
        content: Content.HeaderAd,
      }),
    ).catch(() => undefined);
  }, []);

  if (!loggedIn) {
    return (
      <Button brand="primary" onClick={handleLogin}>
        {t("Log in")}
      </Button>
    );
  }

  if (premium) {
    return (
      <Typography appearance="moderate" data-testid="premium-indicator" typographyType="title-sm">
        {t("Premium")}
      </Typography>
    );
  }

  if (showAd) {
    return (
      <Button brand="premium" leftIconPath={mdiDiamondStone} onClick={handleGoPremium}>
        {t("Go premium")}
      </Button>
    );
  }

  return null;
};
