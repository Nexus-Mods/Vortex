import { mdiChevronDown } from "@mdi/js";
import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";

import { Listbox } from "@/ui/components/listbox/Listbox";
import { ListboxButton } from "@/ui/components/listbox/ListboxButton";
import { ListboxOption } from "@/ui/components/listbox/ListboxOption";
import { ListboxOptions } from "@/ui/components/listbox/ListboxOptions";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { joinClasses } from "@/ui/utils/joinClasses";

import { MOD_TYPE as COLLECTION_TYPE } from "../../../collections/constants";
import type { IMod } from "../../types/IMod";
import { CollectionRevision } from "../collection_revision/CollectionRevision";
import { ModUpdate, modUpdateShows } from "../mod_update/ModUpdate";
import { VersionText } from "../version_text/VersionText";

interface IModVersionProps {
  /** The mod the row shows: the one of its versions that's in use. */
  mod: IMod;
  /** Every installed version and variant of it, itself included; unset for only the one. */
  alternatives?: IMod[];
  /** Switches from the mod to another of its versions or variants, by id. */
  onSelect: (modId: string, alternativeId: string) => void;
}

/** A version and its variant, as the legacy table named each option; an empty variant is none. */
const versionLabel = (mod: IMod, t: TFunction) =>
  `${mod.attributes?.version ?? ""} (${mod.attributes?.variant || t("default")})`;

/** What the cell shows, as text: the version, with its variant while there's a choice. */
export const modVersionText = (mod: IMod, alternatives: IMod[] | undefined, t: TFunction) =>
  mod.type !== COLLECTION_TYPE && (alternatives?.length ?? 0) > 1
    ? versionLabel(mod, t)
    : (mod.attributes?.version ?? "");

/**
 * A mod's version and what it says about updating, or a collection's revision with its
 * update and changelog. A mod with other versions or variants installed shows them in a
 * dropdown, to switch between, the whole of the one in use in a tooltip, as the cell
 * truncates it.
 */
export const ModVersion = ({ mod, alternatives, onSelect }: IModVersionProps) => {
  if (mod.type === COLLECTION_TYPE) {
    return <CollectionRevision collection={mod} />;
  }

  const hasChoice = alternatives !== undefined && alternatives.length > 1;

  return (
    // The version shrinks before the buttons after it, which sit closer to a dropdown.
    <div className={joinClasses(["flex min-w-0 items-center", hasChoice ? "gap-x-1" : "gap-x-2"])}>
      {!hasChoice ? (
        <VersionText fixed={modUpdateShows(mod)} version={mod.attributes?.version ?? ""} />
      ) : (
        <ModVersionPicker alternatives={alternatives} mod={mod} onSelect={onSelect} />
      )}

      <ModUpdate mod={mod} />
    </div>
  );
};

/** The dropdown of a mod's installed versions and variants, the one in use showing. */
const ModVersionPicker = ({ mod, alternatives, onSelect }: Required<IModVersionProps>) => {
  const { t } = useTranslation(["common"]);
  const label = versionLabel(mod, t);

  return (
    <Listbox
      className="flex min-w-0"
      value={mod.id}
      onChange={(alternativeId: string) => onSelect(mod.id, alternativeId)}
    >
      <Tooltip
        customContent={
          // A tooltip's own padding and type, which custom content goes without.
          <div className="nxm-tooltip-content space-y-0.5">
            <p>{label}</p>

            <p className="text-neutral-subdued">{t("Switch version or variant")}</p>
          </div>
        }
      >
        {/* A span, as the button can't hold the tooltip's ref. */}
        <span className="flex min-w-0">
          {/* As wide as its label, up to the cell's width, past which the label truncates:
              shrinking, as a button doesn't by default. */}
          <ListboxButton
            className="min-w-0 shrink px-1 [&>span]:truncate"
            rightIconPath={mdiChevronDown}
            showChevron={false}
          >
            {label}
          </ListboxButton>
        </span>
      </Tooltip>

      <ListboxOptions anchor={{ gap: 4, to: "bottom start" }}>
        {alternatives.map((alternative) => (
          <ListboxOption
            key={alternative.id}
            label={versionLabel(alternative, t)}
            value={alternative.id}
          />
        ))}
      </ListboxOptions>
    </Listbox>
  );
};
