import I18next from "i18next";
import memoize from "memoize-one";
import * as React from "react";
import { ControlLabel, ListGroup, ListGroupItem } from "react-bootstrap";
import { ComponentEx, Toggle, types, util } from "vortex-api";
import {
  ICollectionModRule,
  ICollectionModRuleEx,
} from "../../types/ICollection";
import { renderReference, ruleId } from "../../util/util";

export interface IModsPageProps {
  t: I18next.TFunction;
  collection: types.IMod;
  mods: { [modId: string]: types.IMod };
  rules: ICollectionModRule[];
  onSetCollectionAttribute: (path: string[], value: any) => void;
}

type IProps = IModsPageProps;

class ModRulesPage extends ComponentEx<IProps, {}> {
  private mAugmentedRules = memoize((rules: ICollectionModRule[]) =>
    rules.map((rule) => this.augmentRule(rule)),
  );
  private mFilteredRules = memoize(
    (collection: types.IMod, rules: ICollectionModRuleEx[]) =>
      rules.filter((rule) => !util.testModReference(collection, rule.source)),
  );

  public shouldComponentUpdate(nextProps: IProps) {
    return (
      this.props.t !== nextProps.t ||
      this.props.collection !== nextProps.collection ||
      this.props.mods !== nextProps.mods ||
      this.props.rules !== nextProps.rules ||
      this.props.onSetCollectionAttribute !== nextProps.onSetCollectionAttribute
    );
  }

  public render(): React.ReactNode {
    const { t, collection } = this.props;

    const rules = this.mAugmentedRules(this.props.rules);
    const filtered = this.mFilteredRules(collection, rules);

    let lastSourceName: string;

    return (
      <div id="collection-mod-rules" className="collection-rules-edit">
        <ControlLabel>
          <p>
            {t(
              "By default the collection will replicate all your custom rules that dictate " +
                "the deployment order of mods.",
            )}
            &nbsp;
            {t(
              "If you disable rules here your collection may produce unresolved file conflicts " +
                "that the user has to resolve.",
            )}
          </p>
        </ControlLabel>
        <div>
          <a onClick={this.enableAllRules}>{t("Enable all")}</a>
          <span className="link-action-seperator">&nbsp; | &nbsp;</span>
          <a onClick={this.disableAllRules}>{t("Disable all")}</a>
        </div>
        <ListGroup>
          {filtered.sort(this.ruleSort).map((rule, idx) => {
            const separator: boolean = rule.sourceName !== lastSourceName;
            lastSourceName = rule.sourceName;
            return this.renderRule(rule, idx, separator);
          })}
        </ListGroup>
      </div>
    );
  }

  private augmentRule(rule: ICollectionModRule): ICollectionModRuleEx {
    return {
      ...rule,
      sourceName: renderReference(rule.source, this.props.mods),
      referenceName: renderReference(rule.reference, this.props.mods),
    };
  }

  private setRulesEnabled(enable: boolean) {
    const { collection, onSetCollectionAttribute } = this.props;
    const rules = this.mAugmentedRules(this.props.rules);
    const filtered = this.mFilteredRules(collection, rules);
    filtered.forEach((rule) => {
      onSetCollectionAttribute(["rule", ruleId(rule)], enable);
    });
  }

  private enableAllRules = () => {
    this.setRulesEnabled(true);
  };

  private disableAllRules = () => {
    this.setRulesEnabled(false);
  };

  private ruleSort = (lhs: ICollectionModRuleEx, rhs: ICollectionModRuleEx) => {
    return lhs.sourceName.localeCompare(rhs.sourceName);
  };

  private renderRule(
    rule: ICollectionModRuleEx,
    idx: number,
    separator: boolean,
  ): JSX.Element {
    const { collection } = this.props;

    const id = ruleId(rule);

    const checked = collection.attributes?.collection?.rule?.[id] ?? true;

    return (
      <ListGroupItem
        className={separator ? "collection-rule-separator" : undefined}
        key={idx.toString()}
      >
        <Toggle checked={checked} dataId={id} onToggle={this.toggleRule}>
          <div className="rule-name">{rule.sourceName}</div>
          <div className="rule-type">{rule.type}</div>
          <div className="rule-name">{rule.referenceName}</div>
        </Toggle>
      </ListGroupItem>
    );
  }

  private toggleRule = (newValue: boolean, dataId: string) => {
    const { onSetCollectionAttribute } = this.props;
    onSetCollectionAttribute(["rule", dataId], newValue);
  };
}

export default ModRulesPage;
