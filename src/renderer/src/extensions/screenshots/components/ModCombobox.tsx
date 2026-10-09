import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getGame } from "@/extensions/gamemode_management/util/getGame";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Typography } from "@/ui/components/typography/Typography";

import useLocalModsSearch from "../hooks/LocalModsSearch";
import useNexusModsSearch from "../hooks/NexusModsSearch";
import { ComboboxGroup, ComboboxInput, ComboboxOption, ComboboxOptions } from "./combobox/Combobox";
import { ComboboxField } from "./combobox/ComboboxField";
import FloatingSearchBarSkeletonTile from "./FloatingSearchBarSkeletonTile";

/** Normalised across both sources so callers never branch on provenance. */
export interface IModOption {
  key: string;
  name: string;
  modId: number;
  gameDomain: string;
  fileId?: number;
  thumbnail?: string;
  uid?: string;
  url?: string;
  source: "installed" | "nexus";
}

interface IModComboboxProps {
  api: IExtensionApi;
  domainName: string;
  /** Names the control. Shown above it, like the other fields in the form. */
  label?: string;
  /** Hides the label on screen; screen readers still read it. */
  hideLabel?: boolean;
  value: IModOption | null;
  onChange: (value: IModOption | null) => void;
}

export default function ModCombobox({
  api,
  domainName,
  label,
  value,
  hideLabel,
  onChange,
}: IModComboboxProps) {
  const { t } = useTranslation("media_page");
  const [query, setQuery] = useState("");

  const { results: localResults } = useLocalModsSearch(query);
  const { results: nexusResults, isLoading } = useNexusModsSearch(query, api, {
    tryToUseLogin: true,
    debounceDelayMs: 500,
  });

  const installed: IModOption[] = localResults.map((mod) => ({
    key: `installed:${mod.id}`,
    name: mod.attributes?.modName ?? mod.attributes?.name ?? mod.id,
    source: "installed",
    thumbnail: mod.attributes.pictureUrl,
    modId: mod.attributes?.modId,
    gameDomain: nexusGameId(getGame(mod.attributes?.downloadGame)) ?? domainName,
    fileId: mod.attributes.fileId,
  }));

  const nexus: IModOption[] = nexusResults.map((r) => ({
    key: `nexus:${r.uid}`,
    uid: r.uid,
    name: r.name,
    thumbnail: r.adult ? r.thumbnailBlurredUrl : r.thumbnailUrl,
    url: `https://nexusmods.com/${domainName}/mods/${r.modId}`,
    gameDomain: domainName,
    modId: r.modId,
    source: "nexus",
  }));

  return (
    <ComboboxField
      hideLabel={hideLabel}
      label={label ?? t("add_mod_tag::label")}
      value={value}
      onChange={onChange}
      onClose={() => setQuery("")}
    >
      <ComboboxInput
        autoFocus
        displayValue={(m: IModOption | null) => m?.name ?? ""}
        placeholder={t("floating_search::placeholder")}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ComboboxOptions>
        {installed.length > 0 && (
          <ComboboxGroup label={t("add_mod_tag::group_installed")}>
            {installed.map((option) => (
              <ComboboxOption key={option.key} value={option}>
                {!!option.thumbnail && (
                  <img alt="" className="aspect-mod h-5 rounded-xs" src={option.thumbnail} />
                )}

                <span className="nxm-dropdown-item-label">{option.name}</span>
              </ComboboxOption>
            ))}
          </ComboboxGroup>
        )}

        {isLoading && <FloatingSearchBarSkeletonTile />}

        {nexus.length > 0 && (
          <ComboboxGroup label={t("add_mod_tag::group_nexus")}>
            {nexus.map((option) => (
              <ComboboxOption key={option.key} value={option}>
                {!!option.thumbnail && (
                  <img alt="" className="aspect-mod h-5 rounded-xs" src={option.thumbnail} />
                )}

                <span className="nxm-dropdown-item-label">{option.name}</span>
              </ComboboxOption>
            ))}
          </ComboboxGroup>
        )}

        {!isLoading && installed.length === 0 && nexus.length === 0 && query !== "" && (
          <Typography appearance="subdued" className="px-3 py-2 italic" typographyType="body-sm">
            {t("floating_search::no_results_title", { query })}
          </Typography>
        )}
      </ComboboxOptions>
    </ComboboxField>
  );
}
