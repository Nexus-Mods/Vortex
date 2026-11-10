/**
 * ContextMenu Demo Component
 * Demonstrates a menu opened by a right-click, or Shift+F10 or the Menu key, where it's asked
 * for, with a nested menu opened from one of its rows
 */

import React, { useState } from "react";

import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { Typography } from "@/ui/components/typography/Typography";

import { ContextMenu, contextMenuPosition, type IContextMenuPosition } from "./ContextMenu";

export const ContextMenuDemo = () => {
  const [position, setPosition] = useState<IContextMenuPosition>();
  const [chosen, setChosen] = useState<string>();

  return (
    <div className="space-y-4">
      <Typography appearance="subdued">
        Right-click the area, or focus it and press Shift+F10 or the Menu key.
      </Typography>

      <div
        className="flex h-40 items-center justify-center rounded-sm border border-dashed border-stroke-weak"
        tabIndex={0}
        onContextMenu={(event) => {
          event.preventDefault();
          setPosition(contextMenuPosition(event));
        }}
      >
        <Typography appearance="subdued" typographyType="body-sm">
          {chosen === undefined ? "Right-click here" : `Chose ${chosen}`}
        </Typography>
      </div>

      <ContextMenu position={position} onClose={() => setPosition(undefined)}>
        {(close) => (
          <PopoverMenu
            actions={[
              [
                { label: "Rename", icon: "edit", onClick: () => setChosen("Rename") },
                { label: "Options", icon: "tune", onClick: () => setChosen("Options") },
                {
                  label: "Move to",
                  icon: "drive_file_move",
                  panelRole: "menu",
                  panel: ({ close: closeSubmenu, dismiss }) => (
                    <PopoverMenu
                      actions={[
                        ["Favourites", "Archive", "Trash"].map((place) => ({
                          label: place,
                          onClick: () => setChosen(`Move to ${place}`),
                        })),
                      ]}
                      label="Move to"
                      onClose={closeSubmenu}
                      onSelect={dismiss}
                    />
                  ),
                },
              ],
              [{ label: "Delete", icon: "delete", onClick: () => setChosen("Delete") }],
            ]}
            label="Area actions"
            onSelect={close}
          />
        )}
      </ContextMenu>
    </div>
  );
};
