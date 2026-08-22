import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

export default function FloatingSearchBarNoResults({ query }: { query: string }) {
  if (!query)
    return (
      <div className="flex flex-col items-center gap-y-4 py-4">
        <Typography appearance="subdued" typographyType="body-md">
          Add mods to image
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Select a mod to tag it in this image
        </Typography>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-y-4 py-4">
      <Typography appearance="subdued" typographyType="body-md">
        No mods found for "{query}"
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        Please try expanding your search.
      </Typography>
    </div>
  );
}
