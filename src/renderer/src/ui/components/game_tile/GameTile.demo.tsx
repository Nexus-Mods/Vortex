import { mdiEyeOffOutline, mdiFolderOpenOutline, mdiWeb } from "@mdi/js";
import React from "react";

import { GameTile } from "@/ui/components/game_tile/GameTile";

const menu = {
  label: "Game options",
  actions: [
    [
      { iconPath: mdiEyeOffOutline, label: "Hide", onClick: () => undefined },
      { iconPath: mdiFolderOpenOutline, label: "Open game folder", onClick: () => undefined },
      { iconPath: mdiWeb, label: "Open Nexus Mods Page", onClick: () => undefined },
    ],
  ],
};

export const GameTileDemo = () => (
  <div className="grid-games">
    <GameTile
      imageUrl="https://picsum.photos/seed/skyrim/300/450"
      menu={menu}
      modCount={2}
      name="Skyrim Special Edition"
      primaryAction={{ label: "Activate", onClick: () => undefined }}
    />

    <GameTile
      contributedBy="RyukanoHi"
      imageUrl="https://picsum.photos/seed/plague/300/450"
      menu={menu}
      name="A Plague Tale: Requiem or a longer name than fits"
      primaryAction={{ label: "Add game", onClick: () => undefined }}
    />

    <GameTile menu={menu} name="A game with no art at all" />
  </div>
);
