import React, { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { PREMIUM_PATH } from "@/extensions/nexus_integration/constants";
import { useRefreshUserInfoOnFocus } from "@/extensions/nexus_integration/hooks/useRefreshUserInfoOnFocus";
import { isPremium } from "@/extensions/nexus_integration/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Icon, type IIconProp } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { Campaign, type Content, Section, nexusModsURL } from "@/util/util";

const ListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-x-1">
    <Icon className="mt-0.5 shrink-0 text-premium-strong" name="check" size="xs" />

    {children}
  </li>
);

export interface IPremiumUpsellModalProps {
  api: IExtensionApi;
  isOpen: boolean;
  /** What the user can skip with Premium. */
  title: string;
  /** Why it's Premium-only; line breaks are kept. */
  description: string;
  /** The free way to get it instead. */
  fallbackLabel: string;
  /** The fallback button's icon. */
  fallbackIcon?: IIconProp;
  /** Which upsell sent the user to the Premium page, for the campaign's numbers. */
  content: Content;
  /** Closes it: called when dismissed, and once Premium is unlocked. */
  onClose: () => void;
  /** Takes the free way; it's left to the caller to close the modal. */
  onFallback: () => void;
  /** Called each time it opens, to count it. */
  onShown?: () => void;
  /** Called when the user dismisses it, before `onClose`, to count it. */
  onDismissed?: () => void;
  /** Called when the user heads to the Premium page, to count it. */
  onUnlockClicked?: () => void;
  /** Runs the gated action once the user turns Premium, at most once per opening. */
  onPremiumUnlocked?: () => void;
}

/**
 * Upsell for a Premium-only 1-click action, offering a free fallback beside the Premium page.
 * Stays open while the user buys on the website, refreshing their membership when Vortex regains
 * focus, and runs `onPremiumUnlocked` once it shows they're Premium.
 */
export const PremiumUpsellModal = ({
  api,
  isOpen,
  title,
  description,
  fallbackLabel,
  fallbackIcon,
  content,
  onClose,
  onFallback,
  onShown,
  onDismissed,
  onUnlockClicked,
  onPremiumUnlocked,
}: IPremiumUpsellModalProps) => {
  const { t } = useTranslation(["nexus_integration"]);

  // Callers pass these inline, so they're read through a ref: as deps they'd re-run the effects
  // on every render, counting one opening many times.
  const callbacksRef = useRef({ onClose, onShown, onPremiumUnlocked });
  callbacksRef.current = { onClose, onShown, onPremiumUnlocked };

  useEffect(() => {
    if (isOpen) {
      callbacksRef.current.onShown?.();
    }
  }, [isOpen]);

  // The purchase happens on the website, so watch for it while the upsell is up. This is also why
  // the Premium button doesn't close the modal: staying open is what keeps the check armed until
  // the new membership can be seen.
  useRefreshUserInfoOnFocus(api, isOpen);

  // Premium specifically, not `!shouldShowPremiumAd`: supporters can't download through the
  // client either, and an absent userInfo would read as a purchase that never happened.
  const unlocked = useSelector(isPremium);
  // Guards against re-running the action, not against re-rendering: onClose is usually the
  // parent's setState, so isOpen is still true for the rest of this effect's runs.
  const handledUnlockRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      handledUnlockRef.current = false;
      return;
    }

    if (!unlocked || handledUnlockRef.current) {
      return;
    }

    handledUnlockRef.current = true;
    callbacksRef.current.onClose();
    callbacksRef.current.onPremiumUnlocked?.();
  }, [isOpen, unlocked]);

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={() => {
        onDismissed?.();
        onClose();
      }}
    >
      <Typography appearance="subdued" as="div" className="space-y-2" typographyType="body-sm">
        <p className="whitespace-pre-line">{description}</p>

        <p>{t("premium_upsell::benefits_title")}</p>

        <ul className="space-y-2">
          <ListItem>{t("premium_upsell::benefits::downloads")}</ListItem>

          <ListItem>{t("premium_upsell::benefits::collections")}</ListItem>

          <ListItem>{t("premium_upsell::benefits::speed")}</ListItem>

          <ListItem>{t("premium_upsell::benefits::ad_free")}</ListItem>
        </ul>
      </Typography>

      <div className="mt-4 grid grid-cols-2 gap-x-2">
        <Button
          appearance="moderate"
          brand="neutral"
          className="w-full"
          leftIcon={fallbackIcon}
          onClick={onFallback}
        >
          {fallbackLabel}
        </Button>

        <Button
          brand="premium"
          className="w-full"
          leftIcon="diamond"
          onClick={() => {
            onUnlockClicked?.();

            window.api.shell.openUrl(
              nexusModsURL(PREMIUM_PATH, {
                section: Section.Users,
                campaign: Campaign.BuyPremium,
                content,
              }),
            );
          }}
        >
          {t("premium_upsell::unlock")}
        </Button>
      </div>
    </Modal>
  );
};
