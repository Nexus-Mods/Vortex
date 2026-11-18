import React from "react";

import { SwitchField } from "@/ui/components/form/switch_field/SwitchField";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";

interface IModPropertySwitchProps {
  property: Extract<ModProperty, { kind: "switch" }>;
}

/** An on-off choice, such as an optional INI edit, named by its label. */
export const ModPropertySwitch = ({ property }: IModPropertySwitchProps) => (
  <SwitchField
    checked={property.checked}
    label={property.label}
    onChange={(checked: boolean) => property.onChange(checked)}
  />
);
