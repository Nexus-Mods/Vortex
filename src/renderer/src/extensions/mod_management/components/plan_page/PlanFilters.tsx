import {
  FileSourceKind,
  NexusFileId,
  OperationKind,
  type PlannedDestination,
} from "@nexusmods/mod-pipeline";
import React, { memo, useMemo, type Dispatch, type SetStateAction } from "react";

import { Button } from "@/ui/components/button/Button";
import { SelectField } from "@/ui/components/form/select_field/SelectField";
import { TextField } from "@/ui/components/form/text_field/TextField";

import {
  countByOperation,
  countByState,
  destinationStateLabel,
  nexusFileLabel,
  toggledIn,
  type IPlanFilter,
} from "../../util/planTree";

// a native select is as wide as its longest option
const OPTION_NAME_MAX_LENGTH = 60;

interface IPlanFiltersProps {
  readonly filter: IPlanFilter;
  readonly onFilterChange: Dispatch<SetStateAction<IPlanFilter>>;
  readonly destinations: readonly PlannedDestination[];
  /** the mod each Nexus file belongs to */
  readonly modNames: ReadonlyMap<NexusFileId, string>;
}

/**
 * The plan's counts as filter toggles, by operation and by state, with a mod and a path filter.
 * Memoised for its 2,000-odd mod options.
 */
export const PlanFilters = memo(function PlanFilters({
  filter,
  onFilterChange,
  destinations,
  modNames,
}: IPlanFiltersProps) {
  const operationCounts = useMemo(() => countByOperation(destinations), [destinations]);
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
      .map((nexusFileId) => ({
        nexusFileId,
        label: nexusFileLabel(nexusFileId, modNames),
        shortLabel: nexusFileLabel(nexusFileId, modNames, OPTION_NAME_MAX_LENGTH),
      }))
      .toSorted((lhs, rhs) => lhs.label.localeCompare(rhs.label));
  }, [destinations, modNames]);

  return (
    <div className="space-y-2 p-2">
      <div className="flex flex-wrap gap-2">
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
            {`${destinationStateLabel(state)} ${count}`}
          </Button>
        ))}
      </div>

      <div className="flex flex-col items-start gap-2">
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

          {modOptions.map(({ nexusFileId, label, shortLabel }) => (
            <option key={nexusFileId} title={label} value={nexusFileId}>
              {shortLabel}
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
    </div>
  );
});
