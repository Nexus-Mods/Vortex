import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useMainContext } from "@/contexts";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { nxmCollectionOutline } from "@/ui/icon-paths";

import type { IMod } from "../../types/IMod";

/** Of a mod's actions, those a collection's heading offers, by registered title, in order. */
const COLLECTION_MOD_ACTIONS = [
  { id: "Check for Update", section: "manage" },
  { id: "Apply Collection Rules", section: "manage" },
  { id: "Edit Collection", section: "manage" },
  { id: "Open on Nexus Mods", section: "open" },
];

/**
 * A collection's own row isn't listed, so its group's heading offers what suits a collection, not
 * a mod: its page, checking it for updates, applying its rules, editing it, opening it on Nexus
 * Mods, and removing it as its page does. Of a mod's actions only those, if they apply to it.
 */
export const useCollectionGroupActions = (actionsFor: (modId: string) => IToolbarAction[]) => {
  const { api } = useMainContext();
  const { t } = useTranslation(["common"]);

  return useCallback(
    (collection: IMod): IToolbarAction[] => {
      const available = actionsFor(collection.id);
      const fromMod = COLLECTION_MOD_ACTIONS.flatMap(({ id, section }) => {
        const action = available.find((candidate) => candidate.id === id);
        if (!action) {
          return [];
        }
        return [{ ...action, section }];
      });
      return [
        {
          id: "view-collection",
          label: t("View collection"),
          icon: { path: nxmCollectionOutline },
          section: "view",
          onClick: () => api.events.emit("view-collection", collection.id),
        },
        ...fromMod,
        {
          id: "remove-collection",
          label: t("Remove"),
          icon: "delete",
          section: "remove",
          onClick: () => api.events.emit("remove-collection", collection.id),
        },
      ];
    },
    [actionsFor, api, t],
  );
};
