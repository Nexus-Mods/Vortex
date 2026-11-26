import { actions, selectors, types, util } from "@nexusmods/vortex-api";
import * as React from "react";
import { useDispatch, useStore } from "react-redux";

import HighlightPicker from "./HighlightPicker";

export interface IHighlightModsPanelProps {
  modIds: string[];
}

/** The ids of those mods that are installed, which are the ones a highlight shows on. */
export function installedModIds(state: types.IState, modIds: string[]): string[] {
  const mods = state.persistent.mods[selectors.activeGameId(state)] ?? {};
  return modIds.filter((modId) => mods[modId]?.state === "installed");
}

/**
 * Highlights the selected mods from the Mods table's selection bar, as the classic table's
 * Highlight Mods popover does: each pick applies to every installed mod at once.
 */
function HighlightModsPanel(props: IHighlightModsPanelProps): JSX.Element {
  const { modIds } = props;
  const dispatch = useDispatch();
  const store = useStore<types.IState>();

  const setAttribute = (attributeId: string, value: string) => {
    const state = store.getState();
    const gameId = selectors.activeGameId(state);
    util.batchDispatch(
      dispatch,
      installedModIds(state, modIds).map((modId) =>
        actions.setModAttribute(gameId, modId, attributeId, value),
      ),
    );
  };

  return (
    <div className="highlight-panel">
      <HighlightPicker
        onSelectColor={(color) => setAttribute("color", color)}
        onSelectIcon={(icon) => setAttribute("icon", icon)}
      />
    </div>
  );
}

export default HighlightModsPanel;
