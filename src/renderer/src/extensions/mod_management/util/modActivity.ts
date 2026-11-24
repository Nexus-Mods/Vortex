/**
 * Whether a "mods" activity is underway that moves or deletes mod files: a deployment, a purge
 * or a mod removal. Anything that reads those files from a list built earlier should wait, as
 * the list may name files that are about to disappear, or still credit a mod being removed.
 *
 * Lives next to the code that starts these activities so the names stay in one extension: keep
 * it in step with the startActivity("mods", ...) calls of the deployment, purge and removal
 * flows.
 */
export function isMovingModFiles(modActivity: string[] | undefined): boolean {
  return (modActivity ?? []).some(
    (activity) =>
      activity === "deployment" || activity === "purging" || activity.startsWith("removing_"),
  );
}
