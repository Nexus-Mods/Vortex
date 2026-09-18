import React from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";

export default function FloatingSearchBarNoResults({ query }: { query: string }) {
  const { t } = useTranslation("media_page");
  if (!query)
    return (
      <div className="flex flex-col items-center gap-y-4 py-4">
        <Typography appearance="subdued" typographyType="body-md">
          {t("Add mods to image")}
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {t("Select a mod to tag it in this image")}
        </Typography>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-y-4 py-4">
      <Typography appearance="subdued" typographyType="body-md">
        {t('No mods found for "{{query}}"', { query })}
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        {t("Please try expanding your search.")}
      </Typography>
    </div>
  );
}
