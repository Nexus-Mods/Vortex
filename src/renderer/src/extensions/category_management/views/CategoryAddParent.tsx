import { mdiCancel, mdiPlus } from "@mdi/js";
import React, { useCallback } from "react";

import { Input } from "@/ui/components/form/input/Input";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";

interface ICategoryAddParentProps {
  visible: boolean;
  toggle: () => void;
  create: (name: string, order: number, parent?: string) => void;
  newName: string;
  setNewName: (newName: string) => void;
}

export function CategoryAddParent({
  visible,
  toggle,
  create,
  newName,
  setNewName,
}: ICategoryAddParentProps) {
  const makeCategory = useCallback(() => {
    create(newName, 0, undefined);
    toggle();
  }, [newName, toggle, create]);

  const actions: IToolbarAction[] = [
    {
      label: "Create",
      iconPath: mdiPlus,
      showLabel: true,
      onClick: makeCategory,
      brand: "primary",
      disabled: newName.length < 2,
    },
    {
      label: "Cancel",
      iconPath: mdiCancel,
      showLabel: true,
      onClick: toggle,
    },
  ];

  if (!visible) return null;

  return (
    <div className="mb-2 flex flex-col rounded-sm border border-stroke-weak bg-surface-mid p-4">
      <div className="flex">
        <div className="flex grow gap-2">
          <Input
            hideLabel
            required
            showRequiredLabel
            className="grow"
            minLength={1}
            placeholder="Add category name..."
            size="sm"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>

        <div>
          <Toolbar>
            <ToolbarGroup actions={actions} maxVisible={2} />
          </Toolbar>
        </div>
      </div>
    </div>
  );
}
