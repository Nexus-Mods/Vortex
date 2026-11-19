import React from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyLabel } from "../mod_property_label/ModPropertyLabel";

interface IModPropertyValueProps {
  property: Extract<ModProperty, { kind: "value" }>;
}

/** A value under its label, in body/SM medium, with a button to copy it where it offers one. */
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
        className="truncate font-medium"
        title={property.value}
        typographyType="body-sm"
      >
        {property.value}
      </Typography>

      {property.copyable && (
        <Button
          appearance="weak"
          brand="neutral"
          data-testid={`mod-property-copy-${property.id}`}
          leftIcon="content_copy"
          size="sm"
          title={t("modsTable::properties::copy", { label: property.label })}
          onClick={copy}
        />
      )}
    </ModPropertyLabel>
  );
};
