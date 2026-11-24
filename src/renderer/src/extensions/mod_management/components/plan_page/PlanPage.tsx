import { FileSourceKind, type NexusFileId } from "@nexusmods/mod-pipeline";
import { VortexGameId } from "@vortex/shared";
import React, { useMemo, useSyncExternalStore } from "react";
import { useSelector } from "react-redux";

import { activeGameId } from "@/extensions/profile_management/selectors";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import { modsForActiveGame } from "../../selectors";
import { lastPlanOf, subscribeToLastPlans } from "../../util/lastPlans";
import modName from "../../util/modName";
import { modOrigin } from "../../util/resolverInput";
import { PlanView } from "./PlanView";

interface IPlanPageProps {
  /** whether the page is showing */
  readonly active?: boolean;
  /** the id the page was registered under */
  readonly pageId: string;
}

/** The active game's last plan, every destination of it, in a dev build. */
export const PlanPage = ({ active, pageId }: IPlanPageProps) => {
  const gameId = useSelector(activeGameId);
  const mods = useSelector(modsForActiveGame);
  const lastPlan = useSyncExternalStore(subscribeToLastPlans, () =>
    gameId === undefined || gameId === "" ? undefined : lastPlanOf(VortexGameId(gameId)),
  );

  // a lockfile names a Nexus file, not its mod
  const modNames = useMemo(() => {
    const names = new Map<NexusFileId, string>();
    for (const mod of Object.values(mods)) {
      const origin = modOrigin(mod, gameId);
      if (origin.source === FileSourceKind.Nexus) {
        names.set(origin.nexusFileId, modName(mod));
      }
    }
    return names;
  }, [mods, gameId]);

  return (
    <Page active={active} pageId={pageId} scrollable={false}>
      <PageHeader
        pictogramName="tools"
        subtitle={
          lastPlan === undefined
            ? "This page is only visible in development mode."
            : `Planned ${lastPlan.plannedAt.toLocaleString()}. This page is only visible in development mode.`
        }
        title="Plan"
      />

      {lastPlan === undefined ? (
        <Typography className="p-6">
          No plan yet. A deployment followed by a plugin sort plans Skyrim SE.
        </Typography>
      ) : (
        <PlanView
          destinations={lastPlan.destinations}
          key={lastPlan.plannedAt.toString()}
          modNames={modNames}
        />
      )}
    </Page>
  );
};

export default PlanPage;
