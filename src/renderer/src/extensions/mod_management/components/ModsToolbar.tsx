import React from "react";

import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import type { TFunction } from "@/util/i18n";

import { useModToolbarActions } from "../hooks/useModToolbarActions.hook";

/**
 * The mods page toolbar. See {@link useModToolbarActions} for how the page's own
 * actions and the ones extensions register into `mod-icons` are combined.
 */
export const ModsToolbar = ({ t }: { t: TFunction }) => {
  const actions = useModToolbarActions(t);

  return (
    // without `flex-1` the toolbar keeps every action and runs over the page title
    <Toolbar className="flex-1 justify-end">
      <ToolbarGroup actions={actions} />
    </Toolbar>
  );
};
