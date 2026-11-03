import {
  OperationKind,
  sameOrigin,
  type NexusFileId,
  type PlannedDestination,
} from "@nexusmods/mod-pipeline";
import { QualifiedPath } from "@vortex/shared/filesystem";
import React, { useMemo, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Table } from "@/ui/components/table/Table";
import type { ITableColumn } from "@/ui/components/table/Table.types";
import { PageScroll } from "@/views/components/Page/PageScroll";

import type { LastPlan } from "../../util/lastPlans";
import {
  defaultExpandedFolders,
  destinationStateName,
  filterPlan,
  isEmptyPlanFilter,
  originLabel,
  planPathKeys,
  planRows,
  planTree,
  PlanRowKind,
  toggledIn,
  type IPlanFilter,
  type PlanRow,
} from "../../util/planTree";
import { PlanDestinationDetail } from "./PlanDestinationDetail";
import { PlanFilters } from "./PlanFilters";

interface IPlanViewProps {
  lastPlan: LastPlan;
  /** the mod each Nexus file belongs to */
  modNames: ReadonlyMap<NexusFileId, string>;
}

const NO_FILTER: IPlanFilter = {
  operationKinds: new Set(),
  states: new Set(),
  nexusFileId: undefined,
  pathText: "",
};

const rowId = (row: PlanRow) => row.id;

/** One plan's destinations as a folder tree, with counts, filters and a selected destination. */
export const PlanView = ({ lastPlan, modNames }: IPlanViewProps) => {
  const { destinations } = lastPlan;
  const [filter, setFilter] = useState<IPlanFilter>(NO_FILTER);
  const [selected, setSelected] = useState<PlannedDestination>();

  const fullTree = useMemo(() => planTree(destinations), [destinations]);
  const pathKeys = useMemo(() => planPathKeys(destinations), [destinations]);
  const [expanded, setExpanded] = useState(() => defaultExpandedFolders(fullTree));
  const shownTree = useMemo(
    () =>
      isEmptyPlanFilter(filter) ? fullTree : planTree(filterPlan(destinations, pathKeys, filter)),
    [destinations, filter, fullTree, pathKeys],
  );
  const rows = useMemo(() => planRows(shownTree, expanded), [shownTree, expanded]);

  const columns = useMemo<Array<ITableColumn<PlanRow>>>(
    () => [
      {
        id: "destination",
        header: "Destination",
        width: "minmax(320px, 3fr)",
        cell: (row) => (
          <div className="min-w-0" style={{ paddingLeft: `${row.depth * 16}px` }}>
            {row.kind === PlanRowKind.Folder ? (
              <Button
                appearance="subdued"
                brand="neutral"
                leftIcon={expanded.has(row.folder.path) ? "keyboard_arrow_down" : "chevron_right"}
                size="sm"
                onClick={() => setExpanded((previous) => toggledIn(previous, row.folder.path))}
              >
                {row.folder.name === "" ? "(no folder)" : `${row.folder.name}/`}
              </Button>
            ) : (
              <Button
                appearance={row.destination === selected ? "moderate" : "subdued"}
                brand="neutral"
                size="sm"
                onClick={() => setSelected(row.destination)}
              >
                {QualifiedPath.fromNative(row.destination.destinationPath).basename}
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "state",
        header: "State",
        width: "140px",
        cell: (row) =>
          row.kind === PlanRowKind.Folder
            ? `${row.folder.fileCount} files`
            : `${row.destination.state} ${destinationStateName(row.destination.state)}`,
      },
      {
        id: "operations",
        header: "Operations",
        width: "minmax(180px, 1fr)",
        cell: (row) =>
          row.kind === PlanRowKind.Folder
            ? Object.values(OperationKind)
                .filter((kind) => row.folder.operationCounts[kind] > 0)
                .map((kind) => `${kind} ${row.folder.operationCounts[kind]}`)
                .join(", ")
            : row.destination.operations.map(({ kind }) => kind).join(", "),
      },
      {
        id: "mod",
        header: "Mod",
        width: "minmax(240px, 2fr)",
        cell: (row) => {
          if (row.kind === PlanRowKind.Folder) {
            return "";
          }
          const { current, previous } = row.destination;
          const winner = originLabel(current ?? previous, modNames);
          return current !== undefined && previous !== undefined && !sameOrigin(current, previous)
            ? `${winner}, was ${originLabel(previous, modNames)}`
            : winner;
        },
      },
    ],
    [expanded, modNames, selected],
  );

  return (
    <div className="flex min-h-0 flex-1">
      <PageScroll className="min-w-0 flex-1">
        <Table
          columns={columns}
          empty={<NoResults title="No destination matches the filters" />}
          getRowId={rowId}
          label="Plan"
          rows={rows}
          toolbar={
            <PlanFilters
              destinations={destinations}
              filter={filter}
              modNames={modNames}
              operationCounts={fullTree.operationCounts}
              onFilterChange={setFilter}
            />
          }
        />
      </PageScroll>

      {selected !== undefined && (
        <aside className="w-96 shrink-0 overflow-y-auto border-l border-stroke-weak p-4">
          <PlanDestinationDetail destination={selected} modNames={modNames} />
        </aside>
      )}
    </div>
  );
};
