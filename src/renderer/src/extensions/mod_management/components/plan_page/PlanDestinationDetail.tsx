import type {
  DiskEntry,
  FileSource,
  NexusFileId,
  PlannedDestination,
} from "@nexusmods/mod-pipeline";
import React from "react";

import { Typography } from "@/ui/components/typography/Typography";
import { bytesToString } from "@/util/util";

import { destinationStateName, originLabel } from "../../util/planTree";

interface IPlanDestinationDetailProps {
  destination: PlannedDestination;
  /** the mod each Nexus file belongs to */
  modNames: ReadonlyMap<NexusFileId, string>;
}

const diskLines = (entry: DiskEntry | undefined): string[] =>
  entry === undefined
    ? ["nothing there"]
    : [
        `${entry.kind}, ${bytesToString(entry.size)}, modified ${entry.modifiedTime.toLocaleString()}`,
        entry.contentHash === undefined
          ? "not hashed"
          : `${entry.contentHash.hashType} ${entry.contentHash.fileHash}`,
        ...(entry.id === undefined ? [] : [`file id ${entry.id}, device ${entry.deviceId}`]),
        ...(entry.hardlinkCount === undefined ? [] : [`${entry.hardlinkCount} hardlinks`]),
      ];

const fileLines = (
  file: FileSource | undefined,
  modNames: ReadonlyMap<NexusFileId, string>,
): string[] =>
  file === undefined
    ? ["not in the lockfile"]
    : [originLabel(file, modNames), `${file.hashType} ${file.fileHash}`];

/** What the planner compared at one destination, and what it decided. */
export const PlanDestinationDetail = ({ destination, modNames }: IPlanDestinationDetailProps) => {
  const sections: Array<[string, string[]]> = [
    ["On disk", diskLines(destination.disk)],
    ["Previous lockfile", fileLines(destination.previous, modNames)],
    ["Current lockfile", fileLines(destination.current, modNames)],
    [
      "Operations",
      destination.operations.length === 0
        ? ["none"]
        : destination.operations.map(({ kind }) => kind),
    ],
  ];

  return (
    <Typography as="div" className="space-y-4" typographyType="body-sm">
      <p className="font-semibold break-all">{destination.destinationPath}</p>

      <p>{`${destination.state} ${destinationStateName(destination.state)}`}</p>

      {sections.map(([title, lines]) => (
        <div key={title}>
          <p className="font-semibold">{title}</p>

          {lines.map((line) => (
            <p className="break-all" key={line}>
              {line}
            </p>
          ))}
        </div>
      ))}
    </Typography>
  );
};
