import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import type { IModPropertySection } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyField } from "../mod_property_field/ModPropertyField";

interface IModPropertySectionProps {
  section: IModPropertySection;
}

/** A run of properties, values and fields alike: two to a row in a grid, or one under another. */
export const ModPropertySection = ({ section }: IModPropertySectionProps) => (
  <div
    className={joinClasses([
      "py-4 first:pt-0 last:pb-0",
      section.layout === "grid" ? "grid grid-cols-2 gap-4" : "flex flex-col gap-y-4",
    ])}
    data-testid={`mod-property-section-${section.id}`}
  >
    {section.properties.map((property) => (
      <ModPropertyField key={property.id} property={property} />
    ))}
  </div>
);
