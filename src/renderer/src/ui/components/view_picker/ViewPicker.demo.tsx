import React, { useState } from "react";

import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { Typography } from "@/ui/components/typography/Typography";

import { type IViewPickerView, ViewPicker } from "./ViewPicker";

const menuActions: IMenuAction[][] = [
  [
    { label: "Rename", icon: "edit", onClick: () => undefined },
    { label: "Delete", icon: "delete", onClick: () => undefined },
  ],
];

export const ViewPickerDemo = () => {
  const [selected, setSelected] = useState("trending");
  const [custom, setCustom] = useState<IViewPickerView[]>([
    { id: "mine", label: "My custom view", actions: menuActions },
  ]);

  const views: IViewPickerView[] = [
    { id: "trending", label: "Trending" },
    { id: "popular", label: "Most popular" },
    { id: "new", label: "New" },
    ...custom,
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          View picker
        </Typography>

        <Typography appearance="subdued">
          The views of a list, built in then the user&apos;s own after a divider, and a
          &ldquo;+&rdquo; to add one. The views are one Tab stop; the arrow keys move between them,
          Home and End go to either end, and Space or Enter opens one. A view of the user&apos;s own
          opens its menu from its &ldquo;…&rdquo;, a right-click, Shift+F10 or the Down arrow.
        </Typography>
      </div>

      <ViewPicker
        label="Views"
        selectedView={selected}
        views={views}
        onAddView={() =>
          setCustom((current) => [
            ...current,
            {
              id: `view-${current.length + 1}`,
              label: `View ${current.length + 1}`,
              actions: menuActions,
            },
          ])
        }
        onSelectView={setSelected}
      />
    </div>
  );
};
