import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Typography } from "@/ui/components/typography/Typography";

import useLocalModsSearch from "../hooks/LocalModsSearch";
import useNexusModsSearch from "../hooks/NexusModsSearch";
import {
  Combobox,
  ComboboxGroup,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "./combobox/Combobox";
import FloatingSearchBarSkeletonTile from "./FloatingSearchBarSkeletonTile";

/** Normalised across both sources so callers never branch on provenance. */
export interface IModOption {
  key: string;
  name: string;
  thumbnail?: string;
  url?: string;
  source: "installed" | "nexus";
}

interface IModComboboxProps {
  api: IExtensionApi;
  domainName: string;
  value: IModOption | null;
  onChange: (value: IModOption | null) => void;
}

export default function ModCombobox({ api, domainName, value, onChange }: IModComboboxProps) {
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
  }));

  const nexus: IModOption[] = nexusResults.map((r) => ({
    key: `nexus:${r.uid}`,
    name: r.name,
    thumbnail: r.adult ? r.thumbnailBlurredUrl : r.thumbnailUrl,
    url: `https://nexusmods.com/${domainName}/mods/${r.modId}`,
    source: "nexus",
  }));

  return (
    <Combobox value={value} onChange={onChange} onClose={() => setQuery("")}>
      <ComboboxInput
        autoFocus
        displayValue={(m: IModOption | null) => m?.name ?? ""}
        placeholder={t("floating_search::placeholder")}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ComboboxOptions>
        {installed.length > 0 && (
          <ComboboxGroup label={t("floating_search::group_installed")}>
            {installed.map((option) => (
              <ComboboxOption key={option.key} value={option}>
                <span className="nxm-dropdown-item-label">{option.name}</span>
              </ComboboxOption>
            ))}
          </ComboboxGroup>
        )}

        {isLoading && <FloatingSearchBarSkeletonTile />}

        {nexus.length > 0 && (
          <ComboboxGroup label={t("floating_search::group_nexus")}>
            {nexus.map((option) => (
              <ComboboxOption key={option.key} value={option}>
                {!!option.thumbnail && (
                  <img alt="" className="aspect-mod h-6 rounded-xs" src={option.thumbnail} />
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
    </Combobox>
  );
}
