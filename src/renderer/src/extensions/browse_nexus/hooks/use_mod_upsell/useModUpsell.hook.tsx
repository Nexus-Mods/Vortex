import { NexusGameDomain } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBrowseModsTracker } from "@/extensions/browse_nexus/hooks/browse_mods_tracking/BrowseModsTracking.context";
import { useBrowseWebsiteLink } from "@/extensions/browse_nexus/hooks/use_browse_website_link/useBrowseWebsiteLink.hook";
import { PremiumUpsellModal } from "@/extensions/nexus_integration/components/premium_upsell_modal/PremiumUpsellModal";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { nexusModFilesUrl } from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Content } from "@/util/util";

/** What the upsell was opened from: 1-click, or the menu's View all main files. */
export type UpsellSource = "one-click" | "menu";

/**
 * What 1-click and its Premium upsell say: worded for an update when the user has the mod with one,
 * and otherwise for installing it. The upsell's Premium button keeps its own label for an install.
 */
const oneClickText = (t: TFunction, isUpdate: boolean) =>
  isUpdate
    ? {
        button: t("1-click update"),
        title: t("Skip the website and update instantly."),
        description: t(
          "1-click in app updates are a Premium feature.\n\nFree users download through the website mod pages where ads help keep the platform running.",
        ),
        fallbackLabel: t("Update via mod page (free)"),
        unlockLabel: t("Unlock 1-click updates"),
      }
    : {
        button: t("1-click install"),
        title: t("Skip the website and install instantly."),
        description: t(
          "1-click in app installs are a Premium feature.\n\nFree users download through the website mod pages where ads help keep the platform running.",
        ),
        fallbackLabel: t("Install via mod page (free)"),
        unlockLabel: undefined,
      };

/** What an upsell is tracked as: View all main files, an update, or what 1-click would do. */
const upsellActionOf = (
  isMenu: boolean,
  hasUpdate: boolean,
  action: "install" | "download",
): "view_files" | "update" | "install" | "download" => {
  if (isMenu) {
    return "view_files";
  }

  if (hasUpdate) {
    return "update";
  }

  return action;
};

/** What the upsell needs to know of what the user would do. */
interface IModUpsellOptions {
  /** Whether the user has the mod with an update, so 1-click would update it. */
  hasUpdate: boolean;
  /** What 1-click would do, as the user's settings say. */
  action: "install" | "download";
  /** Does what the upsell was opened for, once the user has unlocked Premium. */
  onUnlocked: (source: UpsellSource | undefined) => void;
}

/**
 * Browse's Premium upsell for a mod: 1-click's label, worded for an install or an update, `open` to
 * show the upsell for 1-click or the menu, and the `modal` for the caller to render once. Its
 * events say which it was for; its fallback opens the mod's Files tab on the site.
 */
export const useModUpsell = (
  api: IExtensionApi,
  mod: ModSummary,
  { hasUpdate, action, onUnlocked }: IModUpsellOptions,
): { oneClickLabel: string; open: (source: UpsellSource) => void; modal: ReactNode } => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const websiteLink = useBrowseWebsiteLink();
  const [source, setSource] = useState<UpsellSource>();
  const { button: oneClickLabel, ...text } = oneClickText(t, hasUpdate);
  const isMenu = source === "menu";
  const upsellAction = upsellActionOf(isMenu, hasUpdate, action);

  const modal = (
    <PremiumUpsellModal
      {...text}
      api={api}
      content={Content.BrowseModsAd}
      fallbackIcon="open_in_new"
      isOpen={!!source}
      title={isMenu ? t("Choose a file to install with Premium.") : text.title}
      onClose={() => setSource(undefined)}
      onDismissed={() =>
        tracker.trackPremiumModalDismissed({ mod_uid: mod.id, action: upsellAction })
      }
      onFallback={() => {
        tracker.trackPremiumModalFallbackClicked({ mod_uid: mod.id, action: upsellAction });
        setSource(undefined);

        window.api.shell.openUrl(
          websiteLink(nexusModFilesUrl(NexusGameDomain(mod.game.domain_name), mod.game_scoped_id)),
        );
      }}
      onPremiumUnlocked={() => onUnlocked(source)}
      onShown={() => tracker.trackPremiumModalShown({ mod_uid: mod.id, action: upsellAction })}
      onUnlockClicked={() =>
        tracker.trackPremiumModalUnlockClicked({ mod_uid: mod.id, action: upsellAction })
      }
    />
  );

  return { oneClickLabel, open: setSource, modal };
};
