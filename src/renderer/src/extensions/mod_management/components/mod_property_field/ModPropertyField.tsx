import React from "react";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModPropertyNotes } from "../mod_property_notes/ModPropertyNotes";
import { ModPropertySelect } from "../mod_property_select/ModPropertySelect";
import { ModPropertySwitch } from "../mod_property_switch/ModPropertySwitch";
import { ModPropertyText } from "../mod_property_text/ModPropertyText";
import { ModPropertyUrl } from "../mod_property_url/ModPropertyUrl";
import { ModPropertyValue } from "../mod_property_value/ModPropertyValue";
import { RegisteredModProperty } from "../registered_mod_property/RegisteredModProperty";

interface IModPropertyFieldProps {
  property: ModProperty;
}

/** A property, drawn as its kind is: a value to read, or a field to change it. */
export const ModPropertyField = ({ property }: IModPropertyFieldProps) => {
  switch (property.kind) {
    case "value":
      return <ModPropertyValue property={property} />;
    case "registered":
      return <RegisteredModProperty property={property} />;
    case "select":
      return <ModPropertySelect property={property} />;
    case "notes":
      // Made again for other mods, or once their notes change elsewhere; typing unsaved then is
      // saved on the way out, to the mods it was typed for.
      return (
        <ModPropertyNotes
          key={[...property.modIds, property.value].join("\n")}
          property={property}
        />
      );
    case "url":
      // Made again for another mod, or once its address changes elsewhere; a valid address typed
      // and unsaved then is saved on the way out, to the mod it was typed for.
      return <ModPropertyUrl key={`${property.modId}\n${property.value}`} property={property} />;
    case "text":
      return <ModPropertyText property={property} />;
    case "switch":
      return <ModPropertySwitch property={property} />;
  }
};
