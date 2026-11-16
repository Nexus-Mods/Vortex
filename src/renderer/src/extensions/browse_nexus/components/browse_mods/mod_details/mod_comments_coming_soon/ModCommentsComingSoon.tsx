import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";

import { useBrowseModsTracker } from "../../../../hooks/browse_mods_tracking/BrowseModsTracking.context";

interface IModCommentsComingSoonProps {
  /** The mod's comments on Nexus Mods. */
  commentsUrl: string;
  /** The mod's uid, which opening its comments is counted against. */
  modUid: string;
}

/**
 * The Comments tab until Vortex shows comments: they're coming, and the website has them. Counts
 * opening them there.
 */
export const ModCommentsComingSoon = ({ commentsUrl, modUid }: IModCommentsComingSoonProps) => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();

  return (
    <div className="rounded-sm bg-translucent-dark-200 py-8">
      <NoResults
        icon="schedule"
        message={t("For now, you can view comments on the Nexus Mods website.")}
        title={t("Mod comments are coming to Vortex soon")}
      >
        <Button
          appearance="moderate"
          brand="neutral"
          rightIcon="open_in_new"
          onClick={() => {
            window.api.shell.openUrl(commentsUrl);
            tracker.trackCommentsOpened({ mod_uid: modUid });
          }}
        >
          {t("View comments")}
        </Button>
      </NoResults>
    </div>
  );
};
