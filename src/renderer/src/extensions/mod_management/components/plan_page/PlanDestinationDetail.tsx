import type { FileSource, NexusFileId, PlannedDestination } from "@nexusmods/mod-pipeline";
import React, { type ReactNode } from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { destinationStateLabel, diskEntryLines } from "../../util/planTree";
import { PlanModOrigin } from "./PlanModOrigin";

interface IPlanDestinationDetailProps {
  readonly destination: PlannedDestination;
  /** the mod each Nexus file belongs to */
  readonly modNames: ReadonlyMap<NexusFileId, string>;
}

const Section = ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
  <div>
    <p className="font-semibold">{title}</p>

    {children}
  </div>
);

const textLines = (lines: readonly string[]) =>
  lines.map((line) => (
    <p className="break-all" key={line}>
      {line}
    </p>
  ));

const lockfileLines = (
  file: FileSource | undefined,
  modNames: ReadonlyMap<NexusFileId, string>,
): ReactNode =>
  file === undefined ? (
    <p>not in the lockfile</p>
  ) : (
    <>
      <p>
        <PlanModOrigin file={file} modNames={modNames} />
      </p>

      <p className="break-all">{`${file.hashType} ${file.fileHash}`}</p>
    </>
  );

/** What the planner compared at one destination, and what it decided. */
export const PlanDestinationDetail = ({ destination, modNames }: IPlanDestinationDetailProps) => (
  <Typography as="div" className="space-y-4" typographyType="body-sm">
    <p className="font-semibold break-all">{destination.destinationPath}</p>

    <p>{destinationStateLabel(destination.state)}</p>

    <Section title="On disk">{textLines(diskEntryLines(destination.disk))}</Section>

    <Section title="Previous lockfile">{lockfileLines(destination.previous, modNames)}</Section>

    <Section title="Current lockfile">{lockfileLines(destination.current, modNames)}</Section>

    <Section title="Operations">
      {textLines(
        destination.operations.length === 0
          ? ["none"]
          : destination.operations.map(({ kind }) => kind),
      )}
    </Section>
  </Typography>
);
