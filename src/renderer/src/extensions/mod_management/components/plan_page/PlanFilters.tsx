import {
  FileSourceKind,
  NexusFileId,
  OperationKind,
  type PlannedDestination,
} from "@nexusmods/mod-pipeline";
import React, { useMemo, type Dispatch, type SetStateAction } from "react";

import { Button } from "@/ui/components/button/Button";
import { SelectField } from "@/ui/components/form/select_field/SelectField";
import { TextField } from "@/ui/components/form/text_field/TextField";

import {
  countByState,
  destinationStateName,
  nexusFileLabel,
  toggledIn,
  type IPlanFilter,
  type PlanOperationCounts,
} from "../../util/planTree";

interface IPlanFiltersProps {
  filter: IPlanFilter;
  onFilterChange: Dispatch<SetStateAction<IPlanFilter>>;
  destinations: readonly PlannedDestination[];
  /** the whole plan's operations, by kind */
  operationCounts: PlanOperationCounts;
  /** the mod each Nexus file belongs to */
  modNames: ReadonlyMap<NexusFileId, string>;
}

/** The plan's counts as filter toggles, by operation and by state, with a mod and a path filter. */
export const PlanFilters = ({
  filter,
  onFilterChange,
  destinations,
  operationCounts,
  modNames,
}: IPlanFiltersProps) => {
  const stateCounts = useMemo(
    () => [...countByState(destinations)].toSorted(([, lhs], [, rhs]) => rhs - lhs),
    [destinations],
  );
  const modOptions = useMemo(() => {
    const nexusFileIds = new Set<NexusFileId>();
    for (const { current, previous } of destinations) {
      for (const file of [current, previous]) {
        if (file?.source === FileSourceKind.Nexus) {
          nexusFileIds.add(file.nexusFileId);
        }
      }
    }
    return [...nexusFileIds]
      .map((nexusFileId) => ({ nexusFileId, label: nexusFileLabel(nexusFileId, modNames) }))
      .toSorted((lhs, rhs) => lhs.label.localeCompare(rhs.label));
  }, [destinations, modNames]);

  return (
    <div className="flex flex-wrap items-end gap-2 p-2">
      {Object.values(OperationKind).map((kind) => (
        <Button
          appearance={filter.operationKinds.has(kind) ? "strong" : "weak"}
          brand="neutral"
          key={kind}
          size="sm"
          onClick={() =>
            onFilterChange((previous) => ({
              ...previous,
              operationKinds: toggledIn(previous.operationKinds, kind),
            }))
          }
        >
          {`${kind} ${operationCounts[kind]}`}
        </Button>
      ))}

      {stateCounts.map(([state, count]) => (
        <Button
          appearance={filter.states.has(state) ? "strong" : "weak"}
          brand="neutral"
          key={state}
          size="sm"
          onClick={() =>
            onFilterChange((previous) => ({
              ...previous,
              states: toggledIn(previous.states, state),
            }))
          }
        >
          {`${state} ${destinationStateName(state)} ${count}`}
        </Button>
      ))}

      <SelectField
        hideLabel
        label="Mod"
        value={filter.nexusFileId ?? ""}
        onChange={(event) =>
          onFilterChange((previous) => ({
            ...previous,
            nexusFileId: event.target.value === "" ? undefined : NexusFileId(event.target.value),
          }))
        }
      >
        <option value="">Any mod</option>

        {modOptions.map(({ nexusFileId, label }) => (
          <option key={nexusFileId} value={nexusFileId}>
            {label}
          </option>
        ))}
      </SelectField>

      <TextField
        hideLabel
        label="Path"
        placeholder="Filter by path"
        value={filter.pathText}
        onChange={(event) =>
          onFilterChange((previous) => ({ ...previous, pathText: event.target.value }))
        }
      />
    </div>
  );
};
