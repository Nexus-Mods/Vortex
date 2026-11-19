import React from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyLabel } from "../mod_property_label/ModPropertyLabel";

interface IModPropertyValueProps {
  property: Extract<ModProperty, { kind: "value" }>;
}

/**
 * A value under its label, in body/SM medium, wrapping to show it whole, with a button to copy it
 * where it offers one.
 */
export const ModPropertyValue = ({ property }: IModPropertyValueProps) => {
  const { t } = useTranslation("mod_management");

  const copy = () =>
    void window.api.clipboard.writeText(property.value).then(
      () => toast.success(t("modsTable::properties::copied")),
      () => toast.error(t("modsTable::properties::copyFailed")),
    );

  return (
    <ModPropertyLabel label={property.label} testId={`mod-property-${property.id}`}>
      <Typography
        appearance="moderate"
        as="span"
        className="min-w-0 font-medium wrap-anywhere"
        typographyType="body-sm"
      >
        {property.value}
      </Typography>

      {property.copyable && (
        <Tooltip content={t("modsTable::properties::copy", { label: property.label })}>
          <Button
            appearance="weak"
            aria-label={t("modsTable::properties::copy", { label: property.label })}
            brand="neutral"
            data-testid={`mod-property-copy-${property.id}`}
            leftIcon="content_copy"
            size="sm"
            onClick={copy}
          />
        </Tooltip>
      )}
    </ModPropertyLabel>
  );
};
