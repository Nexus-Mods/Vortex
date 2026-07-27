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

  // number of versions per modId, cached so we don't rescan the entire mod and
  // download lists for every row we're asked to match
  private mCachedState: any;
  private mCachedMods: { [id: string]: IMod };
  private mCachedDownloads: { [archiveId: string]: any };
  private mVersionCounts: { [modId: string]: number } = {};

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
      if (modId !== undefined && (this.versionCounts(state)[modId] ?? 0) > 1) {
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
   * how many versions of each modId the user has had installed: the mods installed right
   * now plus the archives of versions that were installed at some point in the past.
   * Cached against the state object we last saw so a single filter pass only walks the
   * lists once, and the counts themselves are only rebuilt when the mods or downloads
   * they were derived from actually changed.
   */
  private versionCounts(state: any): { [modId: string]: number } {
    if (state === this.mCachedState) {
      return this.mVersionCounts;
    }
    this.mCachedState = state;

    const gameId = activeGameId(state);
    const mods: { [id: string]: IMod } =
      (gameId !== undefined ? state.persistent.mods?.[gameId] : undefined) ?? {};
    const downloads = state.persistent.downloads?.files ?? {};

    if (mods !== this.mCachedMods || downloads !== this.mCachedDownloads) {
      this.mCachedMods = mods;
      this.mCachedDownloads = downloads;

      const counts: { [modId: string]: number } = {};
      // an archive that is installed right now is already represented by its mod,
      // counting it again would double up
      const installedArchives = new Set<string>();

      for (const mod of Object.values<IMod>(mods)) {
        installedArchives.add(mod.archiveId);
        const modId = mod.attributes?.modId;
        if (mod.state === "installed" && modId !== undefined) {
          counts[modId] = (counts[modId] ?? 0) + 1;
        }
      }

      for (const [archiveId, download] of Object.entries<any>(downloads)) {
        // "installed" is set when an archive is installed and is not cleared on
        // uninstall, so it marks the versions that were installed in the past
        if (
          download.state !== "finished" ||
          download.installed?.gameId !== gameId ||
          installedArchives.has(archiveId)
        ) {
          continue;
        }
        const modId =
          download.modInfo?.ids?.modId ??
          download.modInfo?.nexus?.ids?.modId ??
          download.modInfo?.meta?.details?.modId;
        if (modId !== undefined) {
          counts[modId] = (counts[modId] ?? 0) + 1;
        }
      }

      this.mVersionCounts = counts;
    }

    return this.mVersionCounts;
  }
}

export default VersionFilter;
