import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setDialogVisible } from "@/actions/session";
import { categoryChoices } from "@/extensions/category_management/util/category_choices/categoryChoices";
import { activeGameId } from "@/util/selectors";

import { setModAttribute } from "../../actions/mods";
import type { IModWithState } from "../../types/IModProps";
import { attributeText } from "../../util/attribute_text/attributeText";
import { availableModSources } from "../../util/available_mod_sources/availableModSources";
import {
  modAttributeActions,
  type ModEditableAttribute,
} from "../../util/mod_attribute_actions/modAttributeActions";
import { modsSharedValue } from "../../util/mods_shared_value/modsSharedValue";
import type { ModProperty } from "../use_mod_properties/useModProperties.hook";

/** What the Properties panel lets the user change about the selected mods, by where it shows. */
export interface IModPropertyEdits {
  /** Under the card: the category and notes. */
  organise: ModProperty[];
  /** On Advanced: the source, and a website mod's address. */
  source: ModProperty[];
}

/** A mod's first category, as a string: kept as a number, or as ids in a string. */
const categoryOf = (mod: IModWithState) => {
  const category: unknown = mod.attributes?.category;
  return typeof category === "string" || typeof category === "number"
    ? String(category).split(",")[0]
    : "";
};

/** A text attribute as a field shows it: "" where it's not text, or not kept. */
const textOrEmpty = (value: unknown) => attributeText(value) ?? "";

/**
 * The selected mods' category, notes and source as fields to change, each saved to every
 * selected mod as the legacy table's are: a downloaded mod's category and source on its download.
 * Notes and a website mod's address are offered only for installed mods, as a download has
 * nowhere to keep them; a note saves to the mods it was typed for, which the panel holds on to
 * while it's typed.
 */
export const useModPropertyEdits = (mods: IModWithState[]): IModPropertyEdits => {
  const { t } = useTranslation("mod_management");
  const dispatch = useDispatch();
  const gameId = useSelector(activeGameId);
  const categories = useSelector(categoryChoices);

  const save = useCallback(
    (attribute: ModEditableAttribute, value: string) =>
      modAttributeActions(gameId, mods, attribute, value).forEach((action) => dispatch(action)),
    [dispatch, gameId, mods],
  );

  return useMemo(() => {
    const count = mods.length;
    if (count === 0) {
      return { organise: [], source: [] };
    }

    const [mod] = mods;
    const sources = availableModSources().map(({ id, name }) => ({ value: id, label: name }));
    const source = modsSharedValue(mods, (each) => textOrEmpty(each.attributes?.source));
    const allInstalled = mods.every(({ state }) => state === "installed");
    const isWebsite = count === 1 && allInstalled && mod.attributes?.source === "website";

    return {
      organise: [
        {
          kind: "select",
          id: "category",
          label: t("modsTable::properties::category"),
          hint: t("modsTable::properties::categoryHint", { count }),
          ...modsSharedValue(mods, categoryOf),
          choices: categories,
          onChange: (value) => save("category", value),
          action: {
            icon: "sell",
            label: t("modsTable::properties::manageCategories"),
            onClick: () => dispatch(setDialogVisible("categories")),
          },
        },
        ...(allInstalled
          ? [
              {
                kind: "notes" as const,
                id: "notes",
                label: t("modsTable::properties::notes"),
                hint: t("modsTable::properties::notesHint", { count }),
                ...modsSharedValue(mods, (each) => textOrEmpty(each.attributes?.notes)),
                modIds: mods.map(({ id }) => id),
                onSave: (modIds: string[], text: string) =>
                  modIds.forEach((modId) =>
                    dispatch(setModAttribute(gameId, modId, "notes", text)),
                  ),
              },
            ]
          : []),
      ],
      source: [
        {
          kind: "select",
          id: "source",
          label: t("modsTable::properties::source"),
          hint: t("modsTable::properties::sourceHint", { count }),
          ...source,
          choices: sources,
          onChange: (value) => save("source", value),
        },
        ...(isWebsite
          ? [
              {
                kind: "url" as const,
                id: "website",
                label: t("modsTable::properties::website"),
                value: textOrEmpty(mod.attributes?.url),
                modId: mod.id,
                onSave: (url: string) => dispatch(setModAttribute(gameId, mod.id, "url", url)),
              },
            ]
          : []),
      ],
    };
  }, [categories, dispatch, gameId, mods, save, t]);
};
