import React from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";
import { useRelativeTime } from "@/util/useRelativeTime";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyLabel } from "../mod_property_label/ModPropertyLabel";

interface IModPropertyTimeProps {
  property: Extract<ModProperty, { kind: "time" }>;
}

/**
 * A time under its label, as the table's columns show one, relative to now, and ageing as it
 * stays on screen.
 */
export const ModPropertyTime = ({ property }: IModPropertyTimeProps) => {
  const { t } = useTranslation("common");
  const text = useRelativeTime(property.timestamp, t);

  return (
    <ModPropertyLabel label={property.label} testId={`mod-property-${property.id}`}>
      <Typography
        appearance="moderate"
        as="span"
        className="truncate font-medium"
        title={text}
        typographyType="body-sm"
      >
        {text}
      </Typography>
    </ModPropertyLabel>
  );
};
