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
  /** clips the label with an ellipsis, for a table row, whose height is fixed; it wraps otherwise */
  readonly oneLine?: boolean;
}

/** Where a lockfile's file comes from; an installed Nexus mod links to the Mods page. */
export const PlanModOrigin = ({ file, modNames, oneLine = false }: IPlanModOriginProps) => {
  const { api } = useMainContext();
  const dispatch = useDispatch();
  const modName =
    file?.source === FileSourceKind.Nexus ? modNames.get(file.nexusFileId) : undefined;
  const label = originLabel(file, modNames);

  const title = oneLine ? label : undefined;

  if (modName === undefined) {
    return (
      <span className={oneLine ? "truncate" : undefined} title={title}>
        {label}
      </span>
    );
  }

  const showInModsPage = () => {
    dispatch(setAttributeFilter("mods", "name", modName));
    api.events.emit("show-main-page", "Mods");
  };

  return (
    <Button
      appearance="subdued"
      brand="neutral"
      className={oneLine ? "shrink [&>span]:truncate" : "text-left whitespace-normal"}
      size="sm"
      title={title}
      onClick={showInModsPage}
    >
      {label}
    </Button>
  );
};
