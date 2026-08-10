import * as React from "react";
import { connect } from "react-redux";
import Select from "react-select";

import type { IState } from "../../../types/IState";
import type { IFilterProps, ITableFilter } from "../../../types/ITableAttribute";
import { activeGameId } from "../../profile_management/selectors";
import type { IMod } from "../types/IMod";
import updateState, { isIdValid } from "./modUpdateState";

const PRESET_OPTIONS = [
  { value: "has-update", label: "Update available" },
  { value: "missing-meta", label: "Missing Meta ID" },
  { value: "multi-version", label: "Multiple versions installed" },
];

interface IConnectedProps {
  // the active game's installed mods, keyed by mod id. Undefined until a game is active
  mods: Record<string, IMod> | undefined;
}

type IProps = IFilterProps & IConnectedProps;

class VersionFilterComponent extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { t, filter, mods } = this.props;

    const filterArr: string[] = Array.isArray(filter) ? filter : [];

    const versions = new Set<string>();
    if (mods !== undefined) {
      for (const mod of Object.values<IMod>(mods)) {
        const version = mod.attributes?.version;
        if (version !== undefined && version !== "") {
          versions.add(version);
        }
      }
    }

    const versionOptions = Array.from(versions)
      .sort()
      .map((v) => ({ value: `v:${v}`, label: v }));

    const options = [
      ...PRESET_OPTIONS.map((o) => ({ ...o, label: t(o.label) })),
      ...versionOptions,
    ];

    return (
      <Select
        multi
        autosize={false}
        className="select-compact"
        options={options}
        placeholder={t("Filter...")}
        value={filterArr}
        onChange={this.changeFilter}
      />
    );
  }

  private changeFilter = (value: Array<{ value: string; label: string }>) => {
    const { attributeId, onSetFilter } = this.props;
    const values = [...new Set((Array.isArray(value) ? value : []).map((v) => v.value))];
    onSetFilter(attributeId, values.length > 0 ? values : undefined);
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    mods: state.persistent.mods?.[activeGameId(state)],
  };
}

const VersionFilterComponentConn = connect(mapStateToProps)(VersionFilterComponent) as any;

class VersionFilter implements ITableFilter {
  public component = VersionFilterComponentConn;
  public raw = true;
  public dataId = "$";

  // installed versions per Nexus mod id, cached so we don't rescan the mod
  // list for every row we're asked to match
  private mCachedMods: Record<string, IMod> | undefined;
  private mVersionCounts: Record<string, number> = {};

  public matches(filter: any, value: any, state: IState): boolean {
    if (value === undefined) {
      return undefined;
    }

    if (!Array.isArray(filter) || filter.length === 0) {
      return true;
    }

    if (filter.includes("missing-meta") && !isIdValid(value)) {
      return true;
    }

    if (filter.includes("has-update") && updateState(value.attributes) !== "current") {
      return true;
    }

    if (
      filter.includes("multi-version") &&
      value.state === "installed" &&
      (this.versionCounts(state)[value.attributes?.modId] ?? 0) > 1
    ) {
      return true;
    }

    const versionFilters = filter
      .filter((f: string) => f.startsWith("v:"))
      .map((f: string) => f.slice(2));

    if (versionFilters.length > 0) {
      const version: string = value.attributes?.version ?? "";
      if (versionFilters.includes(version)) {
        return true;
      }
    }

    return false;
  }

  public isEmpty(filter: any): boolean {
    return !Array.isArray(filter) || filter.length === 0;
  }

  /**
   * how many versions of each mod are installed, keyed by Nexus mod id. Rebuilt only
   * when the mod list it was derived from actually changed, so a single filter pass
   * walks the list once rather than once per row.
   */
  private versionCounts(state: IState): Record<string, number> {
    const mods = state.persistent.mods?.[activeGameId(state)];

    if (mods !== this.mCachedMods) {
      this.mCachedMods = mods;

      const counts: Record<string, number> = {};
      for (const mod of Object.values<IMod>(mods ?? {})) {
        const modId = mod.attributes?.modId;
        // a nullish or empty modId is "no mod id", not an id every such mod shares
        if (mod.state === "installed" && modId) {
          counts[modId] = (counts[modId] ?? 0) + 1;
        }
      }
      this.mVersionCounts = counts;
    }

    return this.mVersionCounts;
  }
}

export default VersionFilter;
