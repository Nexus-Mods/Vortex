import React from "react";
import { useTranslation } from "react-i18next";

import { Description } from "@/ui/components/form/field/Description";
import { Field } from "@/ui/components/form/field/Field";
import { Label } from "@/ui/components/form/field/Label";
import { Listbox } from "@/ui/components/listbox/Listbox";
import { ListboxButton } from "@/ui/components/listbox/ListboxButton";
import { ListboxOption } from "@/ui/components/listbox/ListboxOption";
import { ListboxOptions } from "@/ui/components/listbox/ListboxOptions";

import type { ModProperty } from "../../hooks/use_mod_properties/useModProperties.hook";

interface IModPropertySelectProps {
  property: Extract<ModProperty, { kind: "select" }>;
}

/**
 * A choice from a list, in the design system's dropdown, under its label with its hint. Its button
 * says "Various" while the mods differ, which isn't offered to pick back, and a value saved that
 * isn't one of the choices as it is. Picking the choice it already has saves nothing.
 */
export const ModPropertySelect = ({ property }: IModPropertySelectProps) => {
  const { t } = useTranslation("mod_management");
  // An extension's own empty choice is the None row, under its label where it gives one, so
  // there's one empty row (and key), named as the legacy pane names it.
  const ownEmpty = property.choices.find(({ value }) => value === "");
  const options = [
    ...(property.required
      ? []
      : [
          {
            value: "",
            label: ownEmpty?.label || property.emptyLabel || t("modsTable::properties::none"),
          },
        ]),
    ...property.choices.filter(({ value }) => property.required || value !== ""),
  ];
  const picked = options.find(({ value }) => value === property.value);
  const shown = property.isVarious
    ? t("modsTable::properties::various")
    : (picked?.label ?? property.valueLabel ?? property.value);

  return (
    <Field disabled={property.disabled}>
      <Label>{property.label}</Label>

      {/* A field's control, as a select is, which spaces the label above it. */}
      <Listbox
        className="nxm-field-control"
        disabled={property.disabled}
        value={property.isVarious ? null : property.value}
        onChange={(value: string) => {
          if (property.isVarious || value !== property.value) {
            property.onChange(value);
          }
        }}
      >
        {/* The design's 240px, a long category path cut short; the whole of it on hover. */}
        <ListboxButton className="w-60 justify-between [&>span]:truncate" title={shown}>
          {shown}
        </ListboxButton>

        <ListboxOptions anchor={{ gap: 4, to: "bottom start" }}>
          {options.map(({ value, label }) => (
            <ListboxOption key={value} label={label} value={value} />
          ))}
        </ListboxOptions>
      </Listbox>

      {!!property.hint && (
        <div className="nxm-field-footer mt-2">
          <div className="nxm-field-messages">
            <Description className="text-body-sm">{property.hint}</Description>
          </div>
        </div>
      )}
    </Field>
  );
};
