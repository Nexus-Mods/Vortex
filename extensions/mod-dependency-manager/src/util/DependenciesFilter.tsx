import memoizeOne from "memoize-one";
import * as React from "react";
import Select from "react-select";
import { types, util } from "vortex-api";
import { NAMESPACE } from "../statics";
import { IBiDirRule } from "../types/IBiDirRule";
import { IConflict } from "../types/IConflict";
import { IModLookupInfo } from "../types/IModLookupInfo";
import { ILocalState } from "../views/DependencyIcon";

export class DependenciesFilterComponent extends React.Component<
  types.IFilterProps,
  {}
> {
  public render(): JSX.Element {
    const { t } = this.props;
    let { filter } = this.props;

    if (!Array.isArray(filter)) {
      // prevent problems on upgrade
      filter = [filter];
    }

    const options = [
      { value: "has-conflict", label: t("Conflict", { ns: NAMESPACE }) },
      { value: "has-unsolved", label: t("Unresolved", { ns: NAMESPACE }) },
      { value: "has-rule", label: t("LO Rule", { ns: NAMESPACE }) },
      { value: "depends", label: filter[2] },
    ];
    return (
      <Select
        className="select-compact"
        options={options}
        value={filter[0]}
        onChange={this.changeFilter}
        searchable={false}
      />
    );
  }

  private changeFilter = (filter: { value: string; label: string }) => {
    const { attributeId, onSetFilter } = this.props;
    onSetFilter(attributeId, filter ? [filter.value] : []);
  };
}

class DependenciesFilter implements types.ITableFilter {
  public component = DependenciesFilterComponent;
  public raw = true;
  public dataId = "id";

  private mLocalState: ILocalState;
  private mGetMods: () => { [modId: string]: types.IMod };
  private mGetConflicts: () => { [modId: string]: IConflict[] };

  private getDependencyRules: (modId: string) => types.IModRule[] = memoizeOne(
    this.getDependencyRulesImpl,
  );

  private getLORules: (modId: string) => types.IModRule[] = memoizeOne(
    this.getLORulesImpl,
  );

  constructor(
    localState: ILocalState,
    getMods: () => { [modId: string]: types.IMod },
    getConflicts: () => { [modId: string]: IConflict[] },
  ) {
    this.mLocalState = localState;
    this.mGetMods = getMods;
    this.mGetConflicts = getConflicts;
  }

  public matches(filter: string[], value: string): boolean {
    if (!Array.isArray(filter)) {
      // prevent problems on upgrade
      filter = [filter];
    }

    // TODO: not trivial to implement, because the value doesn't contain
    //   any information about file conflicts
    if (filter[0] === "has-conflict") {
      const conflicts = this.mGetConflicts();

      if (conflicts === undefined) {
        return false;
      }

      return conflicts[value] !== undefined && conflicts[value].length > 0;
    } else if (filter[0] === "has-unsolved") {
      const conflicts = this.mGetConflicts();
      const mods = this.mGetMods();

      if (
        mods === undefined ||
        mods[value] === undefined ||
        conflicts === undefined
      ) {
        return false;
      }

      const unsolvedConflict = (conflicts[value] || []).find((conflict) => {
        if (conflict.otherMod === undefined) {
          return false;
        }
        const rule = this.findRule(mods[value], conflict.otherMod);
        return rule === undefined;
      });

      return unsolvedConflict !== undefined;
    } else if (filter[0] === "has-rule") {
      return this.getLORules(value).length > 0;
    } else if (filter[0] === "depends") {
      if (value === filter[1]) {
        return true;
      }

      const mods = this.mGetMods();

      /*
      const match = this.getDependencyRules(filter[1]).find(rule =>
        rule.reference['idHint'] === value);
      */
      const match = this.getDependencyRules(filter[1]).find((rule) =>
        util.testModReference(mods[value], rule.reference),
      );

      return match !== undefined;
    } else {
      return true;
    }
  }

  private findRule(source: types.IMod, ref: IModLookupInfo): IBiDirRule {
    return this.mLocalState.modRules.find(
      (rule) =>
        (util.testModReference(source, rule.source) &&
          util.testModReference(ref, rule.reference)) ||
        (util.testModReference(ref, rule.source) &&
          util.testModReference(source, rule.reference)),
    );
  }

  private getDependencyRulesImpl(modId: string) {
    const mod = this.mGetMods()[modId];
    return (mod?.rules ?? []).filter((rule) =>
      ["requires", "recommends"].includes(rule.type),
    );
  }

  private getLORulesImpl(modId: string) {
    const mod = this.mGetMods()[modId];
    return (mod?.rules ?? []).filter((rule) =>
      ["after", "before"].includes(rule.type),
    );
  }
}

export default DependenciesFilter;
