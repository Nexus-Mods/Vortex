import { mdiFolderAlert, mdiUpdate } from "@mdi/js";
import React, { useEffect } from "react";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";

interface ICustomCategoryFetchErrorProps {
  fetch: () => void;
  clear: () => void;
  error: {
    title: string;
    detail?: string;
  };
}

const CustomCategoryFetchError = ({ fetch, clear, error }: ICustomCategoryFetchErrorProps) => {
  useEffect(() => {
    const timer = window.setTimeout(clear, 10000);
    return () => window.clearTimeout(timer);
  }, [clear]);

  return (
    <div className="flex flex-col items-center gap-y-4 py-16">
      <Icon path={mdiFolderAlert} size="lg" />

      <Typography appearance="strong" brand="warning" typographyType="body-lg">
        {error.title}
      </Typography>

      {!!error.detail && (
        <Typography appearance="subdued" typographyType="body-md">
          {error.detail}
        </Typography>
      )}

      <Button
        appearance="subdued"
        brand="neutral"
        leftIconPath={mdiUpdate}
        size="sm"
        onClick={fetch}
      >
        Try again
      </Button>
    </div>
  );
};

export default CustomCategoryFetchError;
