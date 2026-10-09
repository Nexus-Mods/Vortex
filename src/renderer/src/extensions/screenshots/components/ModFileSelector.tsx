import React, { useMemo, useState } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { SelectField } from "@/ui/components/form/select_field/SelectField";

import useNexusModsVersions from "../hooks/NexusModsVersions";
import type { IModFile, IModFileVersion } from "../util/getModFileVersions";

interface IModFileSelectorProps {
  moduid: string;
  api: IExtensionApi;
  onSelect: (version: IModFileVersion) => void;
}

export default function ModFileSelector({ moduid, onSelect, api }: IModFileSelectorProps) {
  const {
    files,
    versions,
    isError,
    isLoading,
    error,
    selectedFile,
    selectedVersion,
    setSelectedFile,
    setSelectedVersion,
  } = useNexusModsVersions(moduid, api);

  const fileVersions = useMemo(
    () => versions?.filter((v) => !!selectedFile && v.file.id === selectedFile?.id),
    [selectedFile, versions],
  );

  const selectVersion = (v: string) => {
    const version: IModFileVersion = versions.find((ver) => ver.id === v);
    setSelectedVersion(version);
    onSelect(version);
  };

  const selectFile = (f: string) => {
    const file: IModFile = files.find((fi) => fi.id === f);
    console.log("Setting file", f, files);
    setSelectedFile(file);
  };

  return (
    <div className="mb-2 flex w-full gap-2">
      <SelectField
        showRequiredLabel
        disabled={isLoading}
        errorMessage={isError ? error?.message : undefined}
        fieldClassName="grow"
        label="Mod File"
        value={selectedFile?.id}
        onChange={(e) => selectFile(e.target.value)}
      >
        {files?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        showRequiredLabel
        disabled={isLoading}
        label="Version"
        value={selectedVersion?.id}
        onChange={(e) => selectVersion(e.target.value)}
      >
        {fileVersions?.map((fv) => (
          <option key={fv.id} value={fv.id}>
            {fv.version}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
