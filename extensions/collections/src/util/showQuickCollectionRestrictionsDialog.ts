import { selectors, types, util } from "vortex-api";

export async function showQuickCollectionRestrictionsDialog(
  api: types.IExtensionApi,
) {
  const t = api.translate;
  const state: types.IState = api.store.getState();
  const profileId = selectors.activeProfile(state)?.id;
  if (!profileId) {
    return;
  }

  const restrictionsDialog = await api.showDialog(
    "info",
    "Quick Collection",
    {
      bbcode: t(
        "Quick Collections create a backup of your mod list for easy import by another PC or mod manager. " +
          'They can be created in a few clicks but do not include all the features of a "full" collection.[br][/br][br][/br]' +
          "Your Quick Collection will include:[br][/br]" +
          "[list]" +
          "[*] All mods downloaded from Nexus Mods that are currently enabled and deployed." +
          "[*] Installer choices for mods that support installers (such as FOMODs)." +
          "[*] File conflict rules." +
          "[*] Load order rules." +
          "[/list][br][/br]" +
          "Quick Collections do NOT include:[br][/br]" +
          "[list]" +
          "[*] Mods from sources other than Nexus Mods." +
          "[*] Alterations you have made mods after installing them." +
          "[*] Outputs of automated tools generated on your PC (FNIS, Script Merger, etc)." +
          "[*] Mods that you have created on your PC and added to Vortex." +
          "[/list][br][/br]" +
          "If you are using this feature migrate your mod list to the Nexus Mods app, see the " +
          `[url=https://nexus-mods.github.io/NexusMods.App/users/gettingstarted/MovingToTheApp/]full guide here.[/url]`,
      ),
    },
    [{ label: "Cancel" }, { label: "Proceed" }],
  );
  return restrictionsDialog.action === "Cancel"
    ? Promise.reject(new util.UserCanceled())
    : Promise.resolve();
}
