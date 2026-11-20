import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { log } from "@/util/log";

/** A read-only address with a button that copies it, which briefly shows a tick once it has. */
export const CopyField = ({ label, value }: { label: string; value: string }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    window.api.clipboard
      .writeText(value)
      .then(() => setCopied(true))
      .catch((err: unknown) => log("warn", "failed to copy the login address", { error: err }));
  };

  return (
    <div className="flex w-full items-center gap-x-2">
      <Input aria-label={label} className="min-w-0 flex-1" readOnly value={value} />

      <Button
        appearance="weak"
        aria-label={copied ? t("Copied") : t("Copy to clipboard")}
        brand="neutral"
        data-testid="login-copy-address"
        leftIcon={copied ? "check" : "content_copy"}
        onClick={copy}
      />
    </div>
  );
};
