import type { IExtensionApi } from "../../../types/IExtensionContext";
import { UserCanceled } from "../../../util/CustomErrors";
import { setConfirmTierZero } from "../../gamemode_management/actions/settings";

/**
 * Asks the user to confirm managing a Tier 0 game. Resolves when the user confirms (or has
 * opted out of the dialog), rejects with UserCanceled on Cancel. Ticking "Don't ask me again"
 * suppresses the dialog for all later Tier 0 games.
 */
export async function confirmTierZero(api: IExtensionApi): Promise<void> {
  if (api.getState().settings.gameMode.confirmTierZero === false) {
    return;
  }

  const t = (key: string): string =>
    api.translate(`profile_management:tierZero.${key}`, {
      isNamespaceKey: true,
    }) as string;

  // The dialog reports the clicked button by its label, which is translated, so compare
  // against the translated label rather than the English one.
  const cancelLabel = t("cancel");

  const result = await api.showDialog(
    "question",
    t("title"),
    {
      text: t("warning"),
      checkboxes: [{ id: "confirm_tier_zero", text: t("dontAskAgain"), value: false }],
    },
    [{ label: cancelLabel }, { label: t("manage") }],
  );

  if (result.action === cancelLabel) {
    throw new UserCanceled();
  }

  if (result.input?.confirm_tier_zero === true) {
    api.store.dispatch(setConfirmTierZero(false));
  }
}
