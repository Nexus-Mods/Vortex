import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IState } from "@/types/IState";
import type { ITableAttribute } from "@/types/ITableAttribute";
import { preT } from "@/util/i18n";

import { modAuthor } from "../../components/mod_author/ModAuthor";
import type { IMod } from "../../types/IMod";
import type { IModWithState } from "../../types/IModProps";
import { attributeText as textOf } from "../../util/attribute_text/attributeText";
import { type ModStatus, localModStatus } from "../../util/mod_status/modStatus";
import { displayName } from "../../util/mods_table_views/modsTableViews";
import type { RegisteredValues } from "../../util/registered_values/registeredValues";
import { useIniTweaks } from "../use_ini_tweaks/useIniTweaks.hook";
import { useModAdvancedEdits } from "../use_mod_advanced_edits/useModAdvancedEdits.hook";
import { useModPropertyEdits } from "../use_mod_property_edits/useModPropertyEdits.hook";

/** The Properties panel's tabs, in order. */
export type ModPropertiesTab = "general" | "advanced";

/** The mod's picture and summary, heading General, as Browse's mod card shows a mod. */
export interface IModPropertiesCard {
  /** Its name, as the table shows it. */
  name: string;
  /** Its summary from the site, if it came from one. */
  summary?: string;
  /** Its whole description from the site, in BBCode, if it came with one. */
  description?: string;
  /** Its author, or its uploader where the author isn't known. */
  author?: string;
  /** Its picture from the site, if it came from one. */
  pictureUrl?: string;
  /** Whether the site marks it adult, so its picture blurs as the user has asked. */
  isAdult: boolean;
  /** Its status tag: downloaded but not installed, or with an update out. */
  status?: ModStatus;
}

/** One of a select's choices: what it saves, and what the user reads. */
export interface IModPropertyChoice {
  /** What picking it saves. */
  value: string;
  label: string;
}

/** What every property has: an id, and a label it shows under. */
interface IModPropertyBase {
  /** Stable, unique among the properties. */
  id: string;
  label: string;
  /** Said under it, where there's more to say than its label. */
  hint?: string;
}

/**
 * One of the properties the panel shows, by `kind`: a value to read, or one to change. One to
 * change says it's various where the selected mods differ, its `value` empty.
 */
export type ModProperty = IModPropertyBase &
  (
    | {
        kind: "value";
        value: string;
        /** Whether it has a button to copy it, as an id does. */
        copyable?: boolean;
      }
    | {
        kind: "time";
        /** When it was, in ms since the epoch; the panel shows it relative to now, ageing. */
        timestamp: number;
      }
    | {
        kind: "select";
        /** The picked choice's value, "" for none or while they differ. */
        value: string;
        /** Whether the selected mods differ. */
        isVarious: boolean;
        /** What it offers, besides none. */
        choices: IModPropertyChoice[];
        /** What none is called, where it means something of its own, as Default does. */
        emptyLabel?: string;
        /** What it says for a value that's none of the choices, in place of the value itself. */
        valueLabel?: string;
        /** Whether it can't be changed for these mods, though it shows. */
        disabled?: boolean;
        /** Whether one of its choices must be picked, so there's no none to pick. */
        required?: boolean;
        /** Saves a pick, "" for none, to every selected mod. */
        onChange: (value: string) => void;
      }
    | {
        kind: "switch";
        checked: boolean;
        onChange: (checked: boolean) => void;
      }
    | {
        kind: "notes";
        /** The mods' notes, "" while they differ. */
        value: string;
        /** Whether the selected mods differ. */
        isVarious: boolean;
        /** The mods the notes are of, by id: those a note typed now is for. */
        modIds: string[];
        /** Saves a note to the mods it was typed for, by id. */
        onSave: (modIds: string[], text: string) => void;
      }
    | {
        kind: "registered";
        /** What an extension registered for the legacy details pane, drawn as it draws it. */
        attribute: ITableAttribute;
        /** The selected mods: one, or several for an attribute that takes several. */
        mods: IModWithState[];
        /** Where its value is worked out and kept, with the table's extension columns'. */
        values: RegisteredValues;
      }
    | {
        kind: "url";
        value: string;
        /** The mod it's of, by id: a draft typed for one is never another's. */
        modId: string;
        onSave: (url: string) => void;
      }
  );

/** A run of properties, ruled off from the next: `grid` lays them out in two columns. */
export interface IModPropertySection {
  /** Stable, unique among the sections. */
  id: string;
  tab: ModPropertiesTab;
  /** `grid` for short values side by side, `list` for one under another. */
  layout: "grid" | "list";
  /** Its properties, in order; never none. */
  properties: ModProperty[];
}

/** What the Properties panel shows for the selected mods. */
export interface IModProperties {
  /** How many mods are selected. */
  count: number;
  /** The card, for one mod only. */
  card?: IModPropertiesCard;
  /** The sections with something in them, in order: General's, then Advanced's. */
  sections: IModPropertySection[];
}

/** The choices made in a mod's FOMOD installer: each group's, on a line of its own. */
const installerChoiceLines = (attributes: IModWithState["attributes"]) => {
  const choices = attributes?.installerChoices;
  if (choices?.type !== "fomod") {
    return [];
  }

  // `options` can be a plain object (collection manifests, older data), as the legacy attribute
  // allows.
  return Object.values(choices.options ?? {}).flatMap((step) =>
    (step?.groups ?? [])
      .filter((group) => (group.choices ?? []).length > 0)
      .map((group) => ({
        label: group.name,
        value: (group.choices ?? []).map(({ name }) => name).join(", "),
      })),
  );
};

/** A value under its label, or nothing where there's no value. */
const valueProperty = (
  id: string,
  label: string,
  value: string | undefined,
  copyable?: boolean,
): ModProperty[] => (value ? [{ kind: "value", id, label, value, copyable }] : []);

/** A time as a property that ages on screen; none where there's no valid one. */
const timeProperty = (
  id: string,
  label: string,
  value: string | number | Date | undefined,
): ModProperty[] => {
  const timestamp = value === undefined ? Number.NaN : new Date(value).getTime();
  return Number.isNaN(timestamp) ? [] : [{ kind: "time", id, label, timestamp }];
};

/** The mod's card: its picture, status, name, summary and author. */
const cardOf = (mod: IModWithState): IModPropertiesCard => ({
  name: displayName(mod),
  summary: textOf(mod.attributes?.shortDescription),
  description: textOf(mod.attributes?.description) || undefined,
  author: modAuthor(mod),
  pictureUrl: textOf(mod.attributes?.pictureUrl),
  isAdult: mod.attributes?.adultContent === true,
  status: localModStatus(mod),
});

/** Its version, and when it was installed, downloaded and enabled. */
const timeProperties = (mod: IModWithState, download: IDownload | undefined, t: TFunction) => [
  ...valueProperty("version", t("modsTable::properties::version"), textOf(mod.attributes?.version)),
  ...timeProperty(
    "installTime",
    t("modsTable::properties::installTime"),
    mod.attributes?.installTime,
  ),
  ...timeProperty("downloadTime", t("modsTable::properties::downloadTime"), download?.fileTime),
  ...timeProperty("enabledTime", t("modsTable::properties::enabledTime"), mod.enabledTime),
];

/**
 * A Nexus Mods collection's id, to copy, or that it isn't published yet, as the legacy field
 * says; nothing for a mod that isn't one.
 */
const collectionIdProperties = (mod: IModWithState, t: TFunction) => {
  if (mod.type !== "collection" || mod.attributes?.source !== "nexus") {
    return [];
  }

  const id = textOf(mod.attributes?.collectionId);
  return valueProperty(
    "nexusCollectionId",
    t("modsTable::properties::nexusCollectionId"),
    id ?? t("modsTable::properties::notPublished"),
    id !== undefined,
  );
};

/**
 * Its Nexus Mods page's id, for a mod from there, or a collection's id for a collection, and the
 * collections it's in, by name.
 */
const linkProperties = (mod: IModWithState, memberships: IMod[], t: TFunction) => [
  ...valueProperty(
    "nexusModId",
    t("modsTable::properties::nexusModId"),
    mod.attributes?.source === "nexus" && mod.type !== "collection"
      ? textOf(mod.attributes?.modId)
      : undefined,
    true,
  ),
  ...collectionIdProperties(mod, t),
  ...valueProperty(
    "collections",
    t("modsTable::properties::collections"),
    memberships
      .map((collection) => displayName(collection))
      .sort((a, b) => a.localeCompare(b))
      .join(", "),
  ),
];

/** Its archive, its variant, and its Nexus Mods file id, for a mod from there. */
const fileProperties = (mod: IModWithState, download: IDownload | undefined, t: TFunction) => [
  ...valueProperty("archiveName", t("modsTable::properties::archiveName"), download?.localPath),
  ...valueProperty("variant", t("modsTable::properties::variant"), textOf(mod.attributes?.variant)),
  ...valueProperty(
    "nexusFileId",
    t("modsTable::properties::nexusFileId"),
    mod.attributes?.source === "nexus" ? textOf(mod.attributes?.fileId) : undefined,
    true,
  ),
];

/** The choices made in its installer, a group's on each line. */
const installerProperties = (mod: IModWithState): ModProperty[] =>
  installerChoiceLines(mod.attributes).map(({ label, value }, index) => ({
    kind: "value",
    id: `installerChoice:${index}`,
    label,
    value,
  }));

/**
 * The legacy details pane's fields shown here as the panel's own, by attribute id, so an
 * extension's field the panel doesn't show is all that's left.
 */
const SHOWN_AS_OWN = new Set([
  "category-detail",
  "notes",
  "modSource",
  "sourceURL",
  "collection",
  "nexusModId",
  "nexusCollectionId",
  "modType",
  "downloadGame",
  "installer",
  "iniEdits",
]);

/** What extensions registered for the legacy details pane, and where their values are kept. */
export interface IRegisteredDetails {
  /** In the pane's order. */
  attributes: ITableAttribute[];
  /** Those of them the table doesn't listen for, as they're no column of it. */
  detailsOnly: ITableAttribute[];
  values: RegisteredValues;
}

/**
 * The fields extensions registered for the legacy details pane that the panel doesn't show as
 * its own, as the legacy pane draws them: by their own renderer, or their value, in an editor where
 * the extension offers one. Several mods get only those that take several, as in the legacy pane.
 */
const registeredProperties = (
  mods: IModWithState[],
  { attributes, values }: IRegisteredDetails,
  t: TFunction,
): ModProperty[] =>
  mods.length === 0
    ? []
    : attributes
        .filter(({ id, calc, customRenderer }) => !SHOWN_AS_OWN.has(id) && (calc || customRenderer))
        .filter(({ supportsMultiple }) => mods.length === 1 || supportsMultiple === true)
        .map((attribute) => ({
          kind: "registered",
          id: `registered:${attribute.id}`,
          // Translated as the legacy pane translates it.
          label: preT(t, attribute.name ?? attribute.id),
          attribute,
          mods,
          values,
        }));

/** A section, laid out as a list unless it says otherwise. */
const section = (
  id: string,
  tab: ModPropertiesTab,
  properties: ModProperty[],
  layout: IModPropertySection["layout"] = "list",
): IModPropertySection => ({ id, tab, layout, properties });

/**
 * The Properties panel's contents for the selected mods. One mod gets its card, what can be
 * changed about it, and its read-only details; several get what can be changed about them all at
 * once, and the extensions' fields that take several. A value a mod doesn't have is left out, as
 * is a section left with nothing.
 *
 * Category and notes come under the card, as the design has them, then the times and the links.
 * The mod type, where it deploys and the game section head Advanced, then the source, and what
 * extensions registered for the legacy details pane ends it. The values are the new table's
 * columns', read the same way.
 */
export const useModProperties = (
  mods: IModWithState[],
  memberships: { [modId: string]: IMod[] },
  registered: IRegisteredDetails,
): IModProperties => {
  const { t } = useTranslation("mod_management");
  const { t: tCommon } = useTranslation("common");
  // The one selected mod's download alone: every download's progress writes to the list.
  const archiveId = mods.length === 1 ? mods[0].archiveId : undefined;
  const selectDownload = useCallback(
    (state: IState): IDownload | undefined =>
      archiveId ? state.persistent.downloads.files[archiveId] : undefined,
    [archiveId],
  );
  const download = useSelector(selectDownload);
  const edits = useModPropertyEdits(mods);
  const advanced = useModAdvancedEdits(mods);
  const iniTweaks = useIniTweaks(mods);

  return useMemo(() => {
    const withContent = (sections: IModPropertySection[]) =>
      sections.filter(({ properties }) => properties.length > 0);

    if (mods.length !== 1) {
      return {
        count: mods.length,
        sections: withContent([
          section("organise", "general", edits.organise),
          section("type", "advanced", advanced),
          section("source", "advanced", edits.source),
          section("registered", "advanced", registeredProperties(mods, registered, tCommon)),
        ]),
      };
    }

    const [mod] = mods;

    return {
      count: 1,
      card: cardOf(mod),
      sections: withContent([
        section("organise", "general", edits.organise),
        section("times", "general", timeProperties(mod, download, t), "grid"),
        section("links", "general", linkProperties(mod, memberships[mod.id] ?? [], t)),
        section("type", "advanced", advanced),
        section("source", "advanced", edits.source),
        section("files", "advanced", fileProperties(mod, download, t)),
        section("installer", "advanced", [...installerProperties(mod), ...iniTweaks]),
        section("registered", "advanced", registeredProperties(mods, registered, tCommon)),
      ]),
    };
  }, [advanced, download, edits, iniTweaks, memberships, mods, registered, t, tCommon]);
};
