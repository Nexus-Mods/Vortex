import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import type { IDeploymentFailure } from "../actions/session";
import { setDeploymentFailures } from "../actions/session";
import { DEPLOYMENT_FAILED_NOTIFICATION_ID, MAX_STORED_DEPLOYMENT_FAILURES } from "../constants";

/** Files the last deployment of this game couldn't place. */
export function deploymentFailures(api: IExtensionApi, gameId: string): IDeploymentFailure[] {
  const state: IState = api.store.getState();
  return state.session.mods.deploymentFailures?.[gameId] ?? [];
}

/**
 * Discards what an earlier deployment recorded. Every caller of
 * {@link IDeploymentMethod.finalize} brackets it with this and
 * {@link reportRecordedFailures}.
 */
export function resetDeploymentFailures(api: IExtensionApi, gameId: string): void {
  api.store.dispatch(setDeploymentFailures(gameId, []));
}

/** Reports what the run recorded, or clears a previous report when it recorded nothing. */
export function reportRecordedFailures(api: IExtensionApi, gameId: string): IDeploymentFailure[] {
  const failures = deploymentFailures(api, gameId);
  if (failures.length > 0) {
    reportDeploymentFailures(api, failures);
  } else {
    api.dismissNotification?.(DEPLOYMENT_FAILED_NOTIFICATION_ID);
  }
  return failures;
}

/** Groups the failures by the mod they are staged under, preserving first-seen order. */
function byMod(failures: IDeploymentFailure[]): Map<string, IDeploymentFailure[]> {
  const grouped = new Map<string, IDeploymentFailure[]>();
  for (const failure of failures) {
    const existing = grouped.get(failure.source);
    if (existing === undefined) {
      grouped.set(failure.source, [failure]);
    } else {
      existing.push(failure);
    }
  }
  return grouped;
}

/**
 * Reports the files a deployment couldn't place. The list can be long, so the notification
 * keeps a short message and puts the affected mods behind a "More" dialog, where each file
 * is a link that opens it in the game directory.
 */
export function reportDeploymentFailures(api: IExtensionApi, failures: IDeploymentFailure[]): void {
  const t = api.translate;
  const grouped = byMod(failures);
  const truncated = failures.length >= MAX_STORED_DEPLOYMENT_FAILURES;

  api.sendNotification({
    id: DEPLOYMENT_FAILED_NOTIFICATION_ID,
    type: "error",
    message: "Some files could not be deployed",
    actions: [
      {
        title: "More",
        action: (dismiss: () => void) => {
          const modSections = Array.from(grouped.entries()).map(([mod, modFailures]) =>
            [
              `[b]${mod}[/b]`,
              ...modFailures.map(
                (failure) =>
                  `[url=cb://reveal/${encodeURIComponent(failure.outputPath)}]${failure.relPath}[/url]`,
              ),
            ].join("<br/>"),
          );

          api
            .showDialog(
              "info",
              "Files could not be deployed",
              {
                bbcode:
                  t(
                    "These files could not be written to the game directory, usually because " +
                      "another application had them open. Close it and deploy again.",
                  ) +
                  "<br/><br/>" +
                  modSections.join("<br/><br/>") +
                  (truncated
                    ? "<br/><br/>" +
                      t("Only the first {{count}} are listed, the log has the rest.", {
                        replace: { count: failures.length },
                      })
                    : ""),
                options: {
                  bbcodeContext: {
                    callbacks: {
                      reveal: (outputPath: string) => window.api.shell.showItemInFolder(outputPath),
                    },
                  },
                },
              },
              [{ label: "Close" }],
            )
            .then(() => dismiss());
        },
      },
    ],
  });
}
