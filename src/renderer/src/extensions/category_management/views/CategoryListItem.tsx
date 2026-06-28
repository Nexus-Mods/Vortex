import {
  mdiCancel,
  mdiChevronDown,
  mdiChevronRight,
  mdiDelete,
  mdiDrag,
  mdiFolderPlus,
  mdiPlus,
  mdiRename,
  mdiSubdirectoryArrowRight,
} from "@mdi/js";
import type { TFunction } from "i18next";
import React, { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";

import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { Icon } from "@/ui/components/icon/Icon";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";

import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";
import CategorySubtitle from "./CategorySubtitle";

const CATEGORY_ITEM = "CATEGORY_ITEM";

interface ICategoryListItemProps {
  t: TFunction;
  category: ICategoriesTreeEntry;
  expand: (id: string) => void;
  remove: (id: string) => void;
  createSubcategory: (name: string, order: number, parent: string) => void;
  renameCategory: (categoryId: string, newCategory: string) => void;
  moveCategory: (
    sourceId: string,
    targetId: string,
    position: "before" | "after" | "inside",
  ) => void;
}

export default function CategoryListItem({
  t,
  category,
  expand,
  remove,
  createSubcategory,
  moveCategory,
  renameCategory,
}: ICategoryListItemProps) {
  const { title, expanded, children, parentId, categoryId, order } = category;
  const ref = useRef<HTMLDivElement | null>(null);
  const [hoverPosition, setHoverPosition] = useState<"before" | "after" | "inside" | null>(null);
  const [{ isDragging: _ }, dragRef] = useDrag({
    type: CATEGORY_ITEM,
    item: { id: categoryId, parentId },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [{ isOver, canDrop: __ }, dropRef] = useDrop({
    accept: CATEGORY_ITEM,
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
    hover: (dragged: { id: string; parentId: string }, monitor) => {
      if (dragged.id === categoryId) {
        setHoverPosition(null);
        return;
      }
      const hoverRect = ref.current?.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!hoverRect || !clientOffset) return;

      const relY = clientOffset.y - hoverRect.top;
      const h = hoverRect.height;

      if (relY < h / 3) setHoverPosition((p) => (p === "before" ? p : "before"));
      else if (relY > (2 * h) / 3) setHoverPosition((p) => (p === "after" ? p : "after"));
      else setHoverPosition((p) => (p === "inside" ? p : "inside"));
    },
    drop: (dragged: { id: string; parentId: string }, monitor) => {
      if (!monitor.didDrop()) {
        const position = hoverPosition ?? "after";
        moveCategory(dragged.id, categoryId, position);
      }
      setHoverPosition(null);
    },
  });

  dragRef(dropRef(ref));

  const showHoverPosition = isOver ? hoverPosition : null;

  const indicatorClass =
    isOver && showHoverPosition === "before"
      ? "border-t-[3px] border-blue-500"
      : isOver && showHoverPosition === "after"
        ? "border-b-[3px] border-blue-500"
        : isOver && showHoverPosition === "inside"
          ? "shadow-[inset_0_0_0_2px_rgba(59,130,246,0.12)]"
          : "";

  const [addNew, setAddNew] = useState(false);
  const [editName, setEditName] = useState(false);
  const [newName, setNewName] = useState(category.title);
  const [newSubcategoryName, setNewSubcategoryName] = useState<string>("");
  const actions: IToolbarAction[] = [
    {
      label: "Edit",
      iconPath: mdiRename,
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

  const rename = () => {
    renameCategory(categoryId, newName);
    setEditMode();
  };

  return (
    <div className="flex flex-col rounded-sm border border-stroke-weak bg-surface-mid p-4">
      <div className={`flex ${indicatorClass}`} ref={ref}>
        <div className="flex grow gap-2">
          <div className="flex items-center gap-2">
            <Icon className="cursor-move" path={mdiDrag} />

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
              <Typography
                title={`Category ID: ${categoryId} - Order ${order}`}
                typographyType="body-sm"
              >
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
                  onClick={rename}
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

            <CategorySubtitle category={category} t={t} />
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
              moveCategory={moveCategory}
              remove={remove}
              renameCategory={renameCategory}
              t={t}
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
