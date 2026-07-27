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
  mods: { [modId: string]: IMod };
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
        className="select-compact"
        options={options}
        value={filterArr}
        onChange={this.changeFilter}
        autosize={false}
        placeholder={t("Filter...")}
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
  const gameId = activeGameId(state);
  return {
    mods: gameId !== undefined ? state.persistent.mods[gameId] : undefined,
  };
}

const VersionFilterComponentConn = connect(mapStateToProps)(VersionFilterComponent) as any;

class VersionFilter implements ITableFilter {
  public component = VersionFilterComponentConn;
  public raw = true;
  public dataId = "$";

  // number of installed mods per modId, cached so we don't rescan the entire
  // mod list for every row we're asked to match
  private mCachedState: any;
  private mCachedMods: { [id: string]: IMod };
  private mInstallCounts: { [modId: string]: number } = {};

  public matches(filter: any, value: any, state: any): boolean {
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

    if (filter.includes("multi-version") && value.state === "installed") {
      const modId = value.attributes?.modId;
      if (modId !== undefined && (this.installCounts(state)[modId] ?? 0) > 1) {
        return true;
      }
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
   * how many installed mods there are for each modId. Cached against the state object
   * we last saw so a single filter pass only walks the mod list once, and the counts
   * themselves are only rebuilt when the mod list actually changed.
   */
  private installCounts(state: any): { [modId: string]: number } {
    if (state === this.mCachedState) {
      return this.mInstallCounts;
    }
    this.mCachedState = state;

    const gameId = activeGameId(state);
    const mods: { [id: string]: IMod } =
      (gameId !== undefined ? state.persistent.mods?.[gameId] : undefined) ?? {};

    if (mods !== this.mCachedMods) {
      this.mCachedMods = mods;
      this.mInstallCounts = Object.values<IMod>(mods).reduce(
        (prev: { [modId: string]: number }, mod: IMod) => {
          const modId = mod.attributes?.modId;
          if (mod.state === "installed" && modId !== undefined) {
            prev[modId] = (prev[modId] ?? 0) + 1;
          }
          return prev;
        },
        {},
      );
    }

    return this.mInstallCounts;
  }
}

export default VersionFilter;
