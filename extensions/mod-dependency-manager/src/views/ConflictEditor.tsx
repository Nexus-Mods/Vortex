import { IConflict } from '../types/IConflict';
import matchReference from '../util/matchReference';
import renderModName from '../util/renderModName';

import { setConflictDialog } from '../actions';

import { IReference, IRule } from 'modmeta-db';
import { ComponentEx, actions as nmmActions, types } from 'nmm-api';
import * as React from 'react';
import { Button, FormControl, ListGroup, ListGroupItem,
         Modal, OverlayTrigger, Popover } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

interface IConnectedProps {
  gameId: string;
  modId: string;
  conflicts: IConflict[];
  mods: { [modId: string]: types.IMod };
}

interface IActionProps {
  onClose: () => void;
  onAddRule: (gameId: string, modId: string, rule: IRule) => void;
}

type IProps = IConnectedProps & IActionProps;

type RuleChoice = undefined | 'before' | 'after' | 'conflicts';

interface IComponentState {
  ruleType: { [modId: string]: RuleChoice };
}

/**
 * editor displaying mods that conflict with the selected one
 * and offering a quick way to set up rules between them
 * 
 * @class ConflictEditor
 * @extends {ComponentEx<IProps, {}>}
 */
class ConflictEditor extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({ ruleType: this.getRuleTypes(props.modId, props.mods, props.conflicts) });
  }

  public componentWillReceiveProps(nextProps: IProps) {
    this.nextState.ruleType =
      this.getRuleTypes(nextProps.modId, nextProps.mods, nextProps.conflicts);
  }

  public render(): JSX.Element {
    const {t, modId, mods, conflicts} = this.props;

    return <Modal show={modId !== undefined} onHide={this.close}>
      <Modal.Header>{renderModName(mods[modId])}</Modal.Header>
      <Modal.Body>
        <ListGroup>
          {conflicts.map(this.renderConflict)}
        </ListGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={this.close}>{t('Cancel')}</Button>
        <Button onClick={this.save}>{t('Save')}</Button>
      </Modal.Footer>
      </Modal>;
  }

  private getRuleTypes(modId: string,
                       mods: { [modId: string]: types.IMod },
                       conflicts: IConflict[]) {
    let res: { [modId: string]: RuleChoice } = {};

    conflicts.forEach(conflict => {
      let existingRule = (mods[modId].rules || [])
        .find(rule => (['before', 'after', 'conflicts'].indexOf(rule.type) !== -1)
          && matchReference(rule.reference, mods[conflict.otherMod])
        );

      res[conflict.otherMod] = existingRule !== undefined
        ? existingRule.type as RuleChoice
        : undefined;
    });

    return res;
  }

  private renderConflict = (conflict: IConflict) => {
    const {t, mods} = this.props;
    const {ruleType} = this.state;
    const popover = <Popover
      className='conflict-popover'
      id={`conflict-popover-${conflict.otherMod}`}
    >
      { conflict.files.sort().map(fileName => <p key={fileName}>{fileName}</p>) }
    </Popover>;

    return (<ListGroupItem key={conflict.otherMod}>
      <FormControl
        className='conflict-rule-select'
        componentClass='select'
        value={ruleType[conflict.otherMod]}
        onChange={this.setRuleType}
        id={conflict.otherMod}
      >
        <option value={undefined}>{t('No rule')}</option>
        <option value='before'>{t('Load before')}</option>
        <option value='after'>{t('Load after')}</option>
        <option value='conflicts'>{t('Conflicts with')}</option>
      </FormControl>
      <div className='conflict-rule-description'>
      <p className='conflict-rule-name'>{renderModName(mods[conflict.otherMod])}</p>
      <OverlayTrigger trigger='click' rootClose placement='right' overlay={popover}>
        <a>{t('{{ count }} conflicting file', {
          count: conflict.files.length,
          replace: { count: conflict.files.length } })}</a>
      </OverlayTrigger>
      </div>
    </ListGroupItem>);
  }

  private close = () => {
    const { onClose } = this.props;
    onClose();
  }

  private setRuleType = (event) => {
    this.nextState.ruleType[event.currentTarget.id] = event.currentTarget.value;
  }

  private makeReference = (mod: types.IMod): IReference => {
    // tslint:disable:no-string-literal
    return (mod.attributes['logicalFileName'] !== undefined)
      ? {
        modId: mod.attributes['modId'],
        logicalFileName: mod.attributes['logicalFileName'],
      } : {
        modId: mod.attributes['modId'],
        fileExpression: mod.attributes['fileExpression'] || mod.attributes['fileName'],
      };
    // tslint:enable:no-string-literal
  }

  private save = () => {
    const { gameId, modId, mods, onAddRule } = this.props;
    const { ruleType } = this.state;
    Object.keys(ruleType).forEach(otherId => {
      if (ruleType[otherId] !== undefined) {
        onAddRule(gameId, modId, {
          reference: this.makeReference(mods[otherId]),
          type: ruleType[otherId],
        });
      }
    });

    this.close();
  }
}

function mapStateToProps(state): IConnectedProps {
  const dialog = state.session.dependencies.conflictDialog || {};
  return {
    gameId: dialog.gameId,
    modId: dialog.modId,
    conflicts: dialog.modId !== undefined ? state.session.dependencies.conflicts[dialog.modId] : [],
    mods: dialog.gameId !== undefined ? state.persistent.mods[dialog.gameId] : {},
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onClose: () => dispatch(setConflictDialog()),
    onAddRule: (gameId, modId, rule) =>
      dispatch(nmmActions.addModRule(gameId, modId, rule)),
  };
}

export default translate(['common', 'dependency-manager'], {wait: false})(
  connect(mapStateToProps, mapDispatchToProps)(
  ConflictEditor
)
) as React.ComponentClass<{}>;
