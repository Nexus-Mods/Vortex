import React from "react";

import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import type { TFunction } from "@/util/i18n";

import { useModToolbarActions } from "../hooks/useModToolbarActions.hook";

/**
 * The mods page toolbar. See {@link useModToolbarActions} for how the page's own
 * actions and the ones extensions register into `mod-icons` are combined.
 *
 * The only toolbar whose clicks are counted, for now: the redesign has to decide which of
 * these buttons earn their place, and nothing on the classic bar is measured at all.
 */
export const ModsToolbar = ({ t }: { t: TFunction }) => {
  const tracking = useToolbarAnalytics("mods");
  const actions = useModToolbarActions(t, tracking.onActionClick);

  return (
    // without `flex-1` the toolbar keeps every action and runs over the page title
    <Toolbar className="flex-1 justify-end" pinningId="mods" tracking={tracking}>
      <ToolbarGroup actions={actions} />
    </Toolbar>
  );
};
