import type { TFunction } from "i18next";

import type { SymbolName } from "@/ui/components/icon/Icon";
import type { IPillBrand } from "@/ui/components/pill/Pill";

import type { IMod } from "../../types/IMod";
import { modHasUpdate } from "../mod_has_update/modHasUpdate";

/** What the user has of a mod, the most pressing first, as its status tag says. */
export type ModStatus = "update" | "installed" | "downloaded";

/** How a status shows: its words, its icon, and the colour its icon takes in a pill. */
export interface IModStatusDisplay {
  label: string;
  icon: SymbolName;
  /** Its pill's icon colour. */
  brand: IPillBrand;
}

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

/**
 * The status to tag one of the user's own mods with: downloaded but not installed, or with an
 * update out. Never installed, which every other mod on the Mods page is, and nothing while it
 * installs.
 */
export const localModStatus = (mod: IMod): ModStatus | undefined => {
  if (mod.state === "downloaded") {
    return "downloaded";
  }

  if (mod.state === "installed" && modHasUpdate(mod)) {
    return "update";
  }

  return undefined;
};
