import { mdiChevronDown, mdiMinusCircleOutline } from "@mdi/js";
import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
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
  /** Removes one of its versions or variants, by id, asking first; unset, none can be. */
  onRemove?: (alternativeId: string) => void;
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
export const ModVersion = ({ mod, alternatives, onSelect, onRemove }: IModVersionProps) => {
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
        <ModVersionPicker
          alternatives={alternatives}
          mod={mod}
          onRemove={onRemove}
          onSelect={onSelect}
        />
      )}

      <ModUpdate mod={mod} />
    </div>
  );
};

/** The dropdown of a mod's installed versions and variants, the one in use showing. */
const ModVersionPicker = ({
  mod,
  alternatives,
  onSelect,
  onRemove,
}: IModVersionProps & { alternatives: IMod[] }) => {
  const { t } = useTranslation(["common"]);
  const label = versionLabel(mod, t);

  // One of a choice each, the one in use checked; each removable, the one in use too.
  const options = alternatives.map(
    (alternative): IMenuAction => ({
      label: versionLabel(alternative, t),
      checked: alternative.id === mod.id,
      onClick: () => alternative.id !== mod.id && onSelect(mod.id, alternative.id),
      control:
        onRemove === undefined
          ? undefined
          : {
              label: t("Remove version"),
              iconPath: mdiMinusCircleOutline,
              onClick: () => onRemove(alternative.id),
            },
    }),
  );

  return (
    <Popover className="flex min-w-0">
      {({ open }) => (
        <>
          <Tooltip
            customContent={
              // A tooltip's own padding and type, which custom content goes without.
              <div className="nxm-tooltip-content space-y-0.5">
                <p>{label}</p>

                <p className="text-neutral-subdued">{t("Switch version or variant")}</p>
              </div>
            }
            disabled={open}
          >
            {/* As wide as its label, up to the cell's width, past which the label truncates:
                shrinking, as a button doesn't by default. */}
            <PopoverButton
              appearance="moderate"
              aria-haspopup="menu"
              brand="neutral"
              className="min-w-0 shrink px-1 [&>span]:truncate"
              rightIconPath={mdiChevronDown}
              size="sm"
            >
              {label}
            </PopoverButton>
          </Tooltip>

          <PopoverPanel
            anchor={{ gap: 4, to: "bottom start" }}
            className="nxm-popover-panel-dropdown"
          >
            {({ close }) => (
              <PopoverMenu actions={[options]} label={t("Versions")} onSelect={close} />
            )}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
};
