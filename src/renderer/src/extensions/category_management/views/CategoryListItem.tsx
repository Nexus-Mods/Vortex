import {
  mdiArrowDown,
  mdiArrowUp,
  mdiCancel,
  mdiChevronDown,
  mdiChevronRight,
  mdiDelete,
  mdiFolderPlus,
  mdiPlus,
  mdiSubdirectoryArrowRight,
  mdiTagEdit,
} from "@mdi/js";
import React, { useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { Icon } from "@/ui/components/icon/Icon";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";

import type { ICategoriesTree } from "../types/ITrees";

interface ICategoryListItemProps {
  category: ICategoriesTree;
  expand: (id: string) => void;
  remove: (id: string) => void;
  createSubcategory: (name: string, order: number, parent: string) => void;
}

export default function CategoryListItem({
  category,
  expand,
  remove,
  createSubcategory,
}: ICategoryListItemProps) {
  const [addNew, setAddNew] = useState(false);
  const [editName, setEditName] = useState(false);
  const [newName, setNewName] = useState(category.title);
  const [newSubcategoryName, setNewSubcategoryName] = useState<string>("");

  const { title, subtitle, expanded, children, parentId, categoryId } = category;
  const actions: IToolbarAction[] = [
    {
      label: "Edit",
      iconPath: mdiTagEdit,
      onClick: () => setEditMode("name"),
    },
    {
      label: "New Sub-Category",
      iconPath: mdiFolderPlus,
      onClick: () => setEditMode("subcategory"),
    },
    {
      label: "Delete",
      iconPath: mdiDelete,
      onClick: () => remove(categoryId),
    },
  ];

  const setEditMode = (type?: "name" | "subcategory") => {
    if (!type) {
      setEditName(false);
      setAddNew(false);
      setNewSubcategoryName("");
      setNewName(title);
    } else if (type === "name") {
      setEditName(true);
      setAddNew(false);
      setNewSubcategoryName("");
    } else if (type === "subcategory") {
      setAddNew(true);
      setEditName(false);
      setNewName(title);
    }
  };

  const createCategory = (name: string) => {
    setEditMode();
    setNewSubcategoryName("");
    createSubcategory(name, 0, categoryId);
    expand(categoryId);
  };

  return (
    <div className="flex flex-col rounded-sm border border-stroke-weak bg-surface-mid p-4">
      <div className="flex">
        <div className="flex grow gap-2">
          <div className="flex items-center gap-2">
            {!!parentId && <Icon path={mdiSubdirectoryArrowRight} />}

            {children.length > 0 && (
              <Button
                appearance="weak"
                aria-label="Exapand/Collapse"
                brand="neutral"
                leftIconPath={expanded ? mdiChevronDown : mdiChevronRight}
                title="Expand/Collapse"
                onClick={() => expand(categoryId)}
              />
            )}
          </div>

          <div>
            {!editName && (
              <Typography title={categoryId} typographyType="body-sm">
                {title}
              </Typography>
            )}

            {editName && (
              <div className="flex gap-2">
                <Input
                  hideLabel
                  className="grow"
                  minLength={1}
                  placeholder="Rename category"
                  size="sm"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />

                <Button
                  appearance="moderate"
                  aria-label="Save"
                  brand="primary"
                  leftIconPath={mdiPlus}
                  size="sm"
                />

                <Button
                  appearance="moderate"
                  aria-label="Cancel"
                  brand="neutral"
                  leftIconPath={mdiCancel}
                  size="sm"
                  onClick={() => setEditMode()}
                />
              </div>
            )}

            <Typography appearance="subdued" typographyType="body-xs">
              {subtitle}
            </Typography>
          </div>
        </div>

        <div>
          <Toolbar>
            <ToolbarGroup actions={actions} maxVisible={4} />
          </Toolbar>
        </div>
      </div>

      {addNew && (
        <div className="flex gap-2">
          <Input
            hideLabel
            className="grow"
            minLength={1}
            placeholder="Add subcategory"
            size="sm"
            type="text"
            value={newSubcategoryName}
            onChange={(e) => setNewSubcategoryName(e.target.value)}
          />

          <Button
            appearance="moderate"
            aria-label="Save"
            brand="primary"
            disabled={newSubcategoryName.length <= 2}
            leftIconPath={mdiPlus}
            size="sm"
            onClick={() => createCategory(newSubcategoryName)}
          />

          <Button
            appearance="moderate"
            aria-label="Cancel"
            brand="neutral"
            leftIconPath={mdiCancel}
            size="sm"
            onClick={() => setEditMode()}
          />
        </div>
      )}

      {children && expanded && (
        <div className="mt-2 flex flex-col">
          {children.map((c) => (
            <CategoryListItem
              category={c}
              createSubcategory={createSubcategory}
              expand={() => expand(c.categoryId)}
              key={c.categoryId}
              remove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const CategoryListSkeletonTile = () => (
  <div className="animate-pulse space-y-2.5 rounded-sm bg-surface-high p-4">
    <div className="h-4 w-1/4 rounded-sm bg-surface-mid" />

    <div className="h-3 w-1/2 rounded-sm bg-surface-mid" />
  </div>
);
