import { mdiFolderPlus, mdiUpdate } from "@mdi/js";
import React from "react";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

interface ICustomNoCategoryResultsProps {
  fetch: () => void;
  create: () => void;
  searchTerm?: string;
}

const CustomNoCategoryResults = ({ fetch, create, searchTerm }: ICustomNoCategoryResultsProps) => {
  return (
    <div className="flex flex-col items-center gap-y-4 py-16">
      <Typography appearance="subdued" typographyType="body-md">
        {!searchTerm && "No categories"}

        {!!searchTerm && `No categories matching "${searchTerm}"`}
      </Typography>

      <Button
        appearance="subdued"
        brand="neutral"
        leftIconPath={mdiFolderPlus}
        size="sm"
        onClick={create}
      >
        Create Category
      </Button>

      <Button
        appearance="subdued"
        brand="neutral"
        leftIconPath={mdiUpdate}
        size="sm"
        onClick={fetch}
      >
        Sync with Nexus Mods
      </Button>
    </div>
  );
};

export default CustomNoCategoryResults;
