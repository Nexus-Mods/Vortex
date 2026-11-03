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
import { Pill } from "@/ui/components/pill/Pill";
import { Table } from "@/ui/components/table/Table";
import type { ITableColumn } from "@/ui/components/table/Table.types";
import { PageScroll } from "@/views/components/Page/PageScroll";

import {
  allFolderPaths,
  defaultExpandedFolders,
  destinationStateName,
  filterPlan,
  isEmptyPlanFilter,
  NO_PLAN_FILTER,
  planPathKeys,
  planRows,
  planTree,
  PlanRowKind,
  toggledIn,
  type IPlanFilter,
  type IPlanFolder,
  type PlanRow,
} from "../../util/planTree";
import { PlanDestinationDetail } from "./PlanDestinationDetail";
import { PlanFilters } from "./PlanFilters";
import { PlanModOrigin } from "./PlanModOrigin";

interface IPlanViewProps {
  readonly destinations: readonly PlannedDestination[];
  /** the mod each Nexus file belongs to */
  readonly modNames: ReadonlyMap<NexusFileId, string>;
}

/** The folders expanded in a filtered tree, which belong to that tree only. */
interface IFilteredExpansion {
  readonly tree: readonly IPlanFolder[];
  readonly paths: ReadonlySet<string>;
}

const rowId = (row: PlanRow) => row.id;

// a line under every row and between columns, for a flat table without groups or sticky columns
const CELL_LINES = [
  "[&_:is(.nxm-table-header,.nxm-table-row,.nxm-table-cell)]:border-stroke-weak",
  "[&_:is(.nxm-table-header,.nxm-table-row)]:border-b",
  "[&_.nxm-table-cell]:self-stretch",
  "[&_.nxm-table-cell+.nxm-table-cell]:border-l",
  "[&_.nxm-table-cell+.nxm-table-cell]:pl-2",
].join(" ");

/** One plan's destinations as a folder tree, with counts, filters and a selected destination. */
export const PlanView = ({ destinations, modNames }: IPlanViewProps) => {
  const [filter, setFilter] = useState<IPlanFilter>(NO_PLAN_FILTER);
  const [selected, setSelected] = useState<PlannedDestination>();

  const fullTree = useMemo(() => planTree(destinations), [destinations]);
  const pathKeys = useMemo(() => planPathKeys(destinations), [destinations]);
  const [expanded, setExpanded] = useState(() => defaultExpandedFolders(fullTree));
  const [filteredExpansion, setFilteredExpansion] = useState<IFilteredExpansion>();
  const filtering = !isEmptyPlanFilter(filter);
  const shownTree = useMemo(
    () => (filtering ? planTree(filterPlan(destinations, pathKeys, filter)) : fullTree),
    [destinations, filter, filtering, fullTree, pathKeys],
  );
  // a filtered tree starts with every folder expanded so its matches show
  const shownExpanded = useMemo(() => {
    if (!filtering) {
      return expanded;
    }
    return filteredExpansion?.tree === shownTree
      ? filteredExpansion.paths
      : allFolderPaths(shownTree);
  }, [expanded, filtering, filteredExpansion, shownTree]);
  const rows = useMemo(() => planRows(shownTree, shownExpanded), [shownTree, shownExpanded]);

  const toggleFolder = (path: string) => {
    if (filtering) {
      setFilteredExpansion({ tree: shownTree, paths: toggledIn(shownExpanded, path) });
    } else {
      setExpanded((previous) => toggledIn(previous, path));
    }
  };

  const columns: Array<ITableColumn<PlanRow>> = [
    {
      id: "destination",
      header: "Destination",
      width: "minmax(320px, 3fr)",
      cell: (row) => (
        <div className="min-w-0" style={{ paddingLeft: `${row.depth * 16}px` }}>
          {row.kind === PlanRowKind.Folder ? (
            <Button
              appearance="subdued"
              aria-expanded={shownExpanded.has(row.folder.path)}
              brand="neutral"
              leftIcon={
                shownExpanded.has(row.folder.path) ? "keyboard_arrow_down" : "chevron_right"
              }
              size="sm"
              onClick={() => toggleFolder(row.folder.path)}
            >
              {`${row.folder.name}/`}
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
      width: "220px",
      cell: (row) =>
        row.kind === PlanRowKind.Folder ? (
          <Pill>{`${row.folder.fileCount} files`}</Pill>
        ) : (
          <>
            <Pill>{row.destination.state}</Pill>

            <span className="truncate">{destinationStateName(row.destination.state)}</span>
          </>
        ),
    },
    {
      id: "operations",
      header: "Operations",
      width: "minmax(180px, 1fr)",
      cell: (row) =>
        row.kind === PlanRowKind.Folder
          ? Object.values(OperationKind)
              .filter((kind) => row.folder.operationCounts[kind] > 0)
              .map((kind) => (
                <Pill key={kind}>{`${kind} ${row.folder.operationCounts[kind]}`}</Pill>
              ))
          : row.destination.operations.map(({ kind }) => <Pill key={kind}>{kind}</Pill>),
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
        const replaced =
          current !== undefined && previous !== undefined && !sameOrigin(current, previous);
        return (
          <div className="flex flex-wrap items-center gap-1">
            <PlanModOrigin file={current ?? previous} modNames={modNames} />

            {replaced && (
              <>
                <span>was</span>

                <PlanModOrigin file={previous} modNames={modNames} />
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1">
      <PageScroll className="min-w-0 flex-1">
        <Table
          className={CELL_LINES}
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
