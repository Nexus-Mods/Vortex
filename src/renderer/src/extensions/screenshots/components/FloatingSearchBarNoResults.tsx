import React from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";

export default function FloatingSearchBarNoResults({ query }: { query: string }) {
  const { t } = useTranslation("media_page");
  if (!query)
    return (
      <div className="flex flex-col items-center gap-y-4 py-4">
        <Typography appearance="subdued" typographyType="body-md">
          {t("floating_search::no_query_title")}
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {t("floating_search::no_query_subtitle")}
        </Typography>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-y-4 py-4">
      <Typography appearance="subdued" typographyType="body-md">
        {t("floating_search::no_results_title", { query })}
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        {t("floating_search::no_results_subtitle")}
      </Typography>
    </div>
  );
}
