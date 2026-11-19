/**
 * Whether a mod activity is underway that moves plugin files: a list scanned or parsed now would
 * name files that are about to disappear, or would still credit a mod that is being removed.
 */
export function movingPluginFiles(modActivity: string[] | undefined): boolean {
  return (modActivity ?? []).some(
    (activity) =>
      activity === "deployment" || activity === "purging" || activity.startsWith("removing_"),
  );
}
