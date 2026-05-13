import * as React from "react";
import { connect } from "react-redux";
import Select from "react-select";

import type { IState } from "../../../types/IState";
import type { IFilterProps, ITableFilter } from "../../../types/ITableAttribute";
import { getSafe } from "../../../util/storeHelper";
import { activeGameId } from "../../profile_management/selectors";
import type { IMod } from "../types/IMod";
import updateState, { isIdValid } from "./modUpdateState";

const PRESET_OPTIONS = [
  { value: "has-update", label: "Update available" },
  { value: "missing-meta", label: "Missing Meta ID" },
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
      for (const mod of Object.values(mods)) {
        const version = getSafe(mod, ["attributes", "version"], undefined);
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

  public matches(filter: any, value: any): boolean {
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

    const versionFilters = filter
      .filter((f: string) => f.startsWith("v:"))
      .map((f: string) => f.slice(2));

    if (versionFilters.length > 0) {
      const version: string = getSafe(value, ["attributes", "version"], "") ?? "";
      if (versionFilters.includes(version)) {
        return true;
      }
    }

    return false;
  }

  public isEmpty(filter: any): boolean {
    return !Array.isArray(filter) || filter.length === 0;
  }
}

export default VersionFilter;
