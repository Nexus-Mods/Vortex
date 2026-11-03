import { FileSourceKind, type FileSource, type NexusFileId } from "@nexusmods/mod-pipeline";
import React from "react";
import { useDispatch } from "react-redux";

import { setAttributeFilter } from "@/actions/tables";
import { useMainContext } from "@/contexts/MainContext";
import { Button } from "@/ui/components/button/Button";

import { originLabel } from "../../util/planTree";

interface IPlanModOriginProps {
  readonly file: FileSource | undefined;
  /** the mod each Nexus file belongs to */
  readonly modNames: ReadonlyMap<NexusFileId, string>;
}

/** Where a lockfile's file comes from; an installed Nexus mod links to the Mods page. */
export const PlanModOrigin = ({ file, modNames }: IPlanModOriginProps) => {
  const { api } = useMainContext();
  const dispatch = useDispatch();
  const modName =
    file?.source === FileSourceKind.Nexus ? modNames.get(file.nexusFileId) : undefined;
  const label = originLabel(file, modNames);

  if (modName === undefined) {
    return label;
  }

  const showInModsPage = () => {
    dispatch(setAttributeFilter("mods", "name", modName));
    api.events.emit("show-main-page", "Mods");
  };

  return (
    <Button appearance="subdued" brand="neutral" size="sm" onClick={showInModsPage}>
      {label}
    </Button>
  );
};
