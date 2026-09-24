import { mdiEyeOffOutline, mdiFolderOpenOutline, mdiPlus, mdiWeb } from "@mdi/js";
import React from "react";

import { Button } from "@/ui/components/button/Button";
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
  // The lit band a detected section sits on, so the tiles are shown on their real ground.
  // Same gradient as DetectedGames - Figma: Game grid (3753:45029).
  <div className="bg-radial-[63.18%_100%_at_50%_100%] from-primary-500/15 from-13% to-primary-500/1 px-6 pt-3 pb-6">
    <div className="grid-games">
      {/* An added game: the action stays out of the tile until it is engaged, lifting the name. */}
      <GameTile
        imageUrl="https://picsum.photos/seed/skyrim/300/450"
        menu={menu}
        name="Skyrim Special Edition"
        primaryAction={
          <Button appearance="strong" brand="neutral" className="w-full" onClick={() => undefined}>
            Open
          </Button>
        }
        revealPrimaryAction={true}
        store="steam"
      />

      {/* A detected game: ringed and bloomed, and its action leads so it is always present. */}
      <GameTile
        highlighted={true}
        imageUrl="https://picsum.photos/seed/plague/300/450"
        menu={menu}
        name="A Plague Tale: Requiem or a longer name than fits"
        primaryAction={
          <Button className="w-full" leftIconPath={mdiPlus} onClick={() => undefined}>
            Add game
          </Button>
        }
        store="gog"
        supportedBy="RyukanoHi"
      />

      {/* A store with no entry in the map: title-cased, and no icon. */}
      <GameTile
        imageUrl="https://picsum.photos/seed/tidebreaker/300/450"
        menu={menu}
        name="Tidebreaker II"
        primaryAction={
          <Button appearance="strong" brand="neutral" className="w-full" onClick={() => undefined}>
            Open
          </Button>
        }
        revealPrimaryAction={true}
        store="itch"
      />

      <GameTile menu={menu} name="A game with no art at all" />
    </div>
  </div>
);
