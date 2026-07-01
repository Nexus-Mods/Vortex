import type { TFunction } from "i18next";
import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";

interface ICategorySubtitleProps {
  category: ICategoriesTreeEntry;
  t: TFunction;
}

export default function CategorySubtitle({ category, t }: ICategorySubtitleProps) {
  const { directModCount, nestedModCount, subCategoryCount } = category;

  let subtitle =
    directModCount === 0 ? t("Empty") : t("{{ count }} mod(s)", { count: directModCount });
  if (subCategoryCount > 0)
    subtitle =
      subtitle +
      t(" ({{ sub }} sub-categories with {{ nested }} mods)", {
        nested: nestedModCount,
        sub: subCategoryCount,
      });

  return (
    <Typography appearance="subdued" typographyType="body-xs">
      {subtitle}
    </Typography>
  );
}
