import React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { useRelativeTime } from "@/util/useRelativeTime";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyLabel } from "../mod_property_label/ModPropertyLabel";

interface IModPropertyTimeProps {
  property: Extract<ModProperty, { kind: "time" }>;
}

/**
 * A time under its label, as the table's columns show one, relative to now, and ageing as it
 * stays on screen; its full date and time on hover, as Browse's mod card shows one.
 */
export const ModPropertyTime = ({ property }: IModPropertyTimeProps) => {
  const { t } = useTranslation("common");
  const text = useRelativeTime(property.timestamp, t);
  const language = useSelector((state: IState) => state.settings.interface.language);
  const stamp = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(property.timestamp);

  return (
    <ModPropertyLabel label={property.label} testId={`mod-property-${property.id}`}>
      <Tooltip content={stamp}>
        <span className="min-w-0 truncate">
          <Typography
            appearance="moderate"
            as="span"
            className="font-medium"
            typographyType="body-sm"
          >
            {text}
          </Typography>
        </span>
      </Tooltip>
    </ModPropertyLabel>
  );
};
