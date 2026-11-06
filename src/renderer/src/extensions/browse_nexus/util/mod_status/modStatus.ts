import type { TFunction } from "i18next";

import type { SymbolName } from "@/ui/components/icon/Icon";
import type { IPillBrand } from "@/ui/components/pill/Pill";

import type { ModInstallState } from "../../hooks/use_mod_install_state/useModInstallState.hook";

/** What Browse says the user has of a mod, the most pressing first. */
export type ModStatus = "update" | "installed" | "downloaded";

/** How a status shows: its words, its icon, and the colour its icon takes in a pill. */
export interface IModStatusDisplay {
  /** What it says. */
  label: string;
  /** Its icon. */
  icon: SymbolName;
  /** Its pill's icon colour. */
  brand: IPillBrand;
}

/** The status to show for what the user has of a mod: none while it's installing, or not had. */
export const modStatus = (state: ModInstallState): ModStatus | undefined => {
  if (state.kind === "installed") {
    return state.update ? "update" : "installed";
  }

  if (state.kind === "downloaded") {
    return "downloaded";
  }

  return undefined;
};

/** How a status shows. */
export const modStatusDisplay = (t: TFunction, status: ModStatus): IModStatusDisplay => {
  switch (status) {
    case "update":
      return { label: t("Update available"), icon: "update", brand: "info" };
    case "installed":
      return { label: t("Installed"), icon: "check_circle", brand: "success" };
    case "downloaded":
      return { label: t("Downloaded"), icon: "download_for_offline", brand: "success" };
  }
};
