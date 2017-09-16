import { IBiDirRule } from '../types/IBiDirRule';
import { IConflict } from '../types/IConflict';
import matchReference from '../util/matchReference';
import renderModName from '../util/renderModName';
import renderReference from '../util/renderReference';

import { setConflictDialog } from '../actions';

import { IReference, IRule } from 'modmeta-db';
import * as React from 'react';
import { Button, FormControl, ListGroup, ListGroupItem,
         Modal, OverlayTrigger, Popover } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import * as ReduxThunk from 'redux-thunk';
import { actions as nmmActions, ComponentEx, tooltip, types } from 'vortex-api';

interface IConnectedProps {
  gameId: string;
  modId: string;
  conflicts: IConflict[];
  modRules: IBiDirRule[];
  mods: { [modId: string]: types.IMod };
}

interface IActionProps {
  onClose: () => void;
  onAddRule: (gameId: string, modId: string, rule: IRule) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IRule) => void;
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
    // find existing rules for these conflicts
    this.nextState.ruleType =
      this.getRuleTypes(nextProps.modId, nextProps.mods, nextProps.conflicts);
  }

  public render(): JSX.Element {
    const {t, modId, mods, conflicts} = this.props;

    return (
      <Modal show={modId !== undefined} onHide={this.close}>
        <Modal.Header><Modal.Title>{renderModName(mods[modId])}</Modal.Title></Modal.Header>
        <Modal.Body>
          <ListGroup>
            {conflicts.map(this.renderConflict)}
          </ListGroup>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.close}>{t('Cancel')}</Button>
          <Button onClick={this.save}>{t('Save')}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private getRuleTypes(modId: string,
                       mods: { [modId: string]: types.IMod },
                       conflicts: IConflict[]) {
    const res: { [modId: string]: RuleChoice } = {};

    conflicts.forEach(conflict => {
      const existingRule = (mods[modId].rules || [])
        .find(rule => (['before', 'after', 'conflicts'].indexOf(rule.type) !== -1)
          && matchReference(rule.reference, conflict.otherMod));

      res[conflict.otherMod.id] = existingRule !== undefined
        ? existingRule.type as RuleChoice
        : undefined;
    });
    return res;
  }

  private renderConflict = (conflict: IConflict) => {
    const {t, modId, modRules, mods} = this.props;
    const {ruleType} = this.state;
    const popover = (
      <Popover
        className='conflict-popover'
        id={`conflict-popover-${conflict.otherMod}`}
      >
        {conflict.files.sort().map(fileName => <p key={fileName}>{fileName}</p>)}
      </Popover>
    );

    let reverseRule: IBiDirRule;

    if (ruleType[conflict.otherMod.name] === undefined) {
      reverseRule = modRules
        .find(rule => !rule.original
                   && matchReference(rule.reference, conflict.otherMod)
                   && matchReference(rule.source, mods[modId]));
    }

    return (
      <ListGroupItem key={conflict.otherMod.id}>
        <FormControl
          className='conflict-rule-select'
          componentClass='select'
          value={ruleType[conflict.otherMod.name]}
          onChange={this.setRuleType}
          id={conflict.otherMod.id}
        >
          <option value='norule'>{t('No rule')}</option>
          <option value='before'>{t('Load before')}</option>
          <option value='after'>{t('Load after')}</option>
          <option value='conflicts'>{t('Conflicts with')}</option>
        </FormControl>
        <div className='conflict-rule-description'>
          <p className='conflict-rule-name'>{renderModName(mods[conflict.otherMod.id])}</p>
          <OverlayTrigger trigger='click' rootClose placement='right' overlay={popover}>
            <a>{
              t('{{ count }} conflicting file', {
                count: conflict.files.length,
                replace: { count: conflict.files.length },
              })
            }</a>
          </OverlayTrigger>
        </div>
        { this.renderReverseRule(reverseRule) }
      </ListGroupItem>
    );
  }

  private renderReverseRule(rule: IBiDirRule) {
    const { t } = this.props;
    if (rule === undefined) {
      return null;
    }

    return (
      <tooltip.Icon
        id={`conflict-editor-${rule.reference.fileMD5}`}
        className='pull-right'
        name='circle-exclamation'
        tooltip={t('{{ otherMod }} has a rule referencing {{ thisMod }}',
          { replace: {
              otherMod: renderReference(rule.reference),
              thisMod: renderReference(rule.source) } })}
      />
    );
  }

  private close = () => {
    const { onClose } = this.props;
    onClose();
  }

  private setRuleType = (event) => {
    (event.currentTarget.value === 'norule')
      ? this.nextState.ruleType[event.currentTarget.id] = undefined
      : this.nextState.ruleType[event.currentTarget.id] = event.currentTarget.value;
  }

  private makeReference = (mod: types.IMod): IReference => {
    // return a reference that matches by name but any version.
    // The version-attribute isn't set at all because there is no pattern
    // in semver that actually matches everything (* doesn't match versions
    // with "-something" at the end)
    return (mod.attributes['logicalFileName'] !== undefined)
      ? {
        logicalFileName: mod.attributes['logicalFileName'],
      } : {
        fileExpression: mod.attributes['fileExpression']
                     || mod.attributes['fileName']
                     || mod.attributes['name'],
      };
  }

  private save = () => {
    const { conflicts, gameId, modId, modRules, mods, onAddRule, onRemoveRule } = this.props;
    const { ruleType } = this.state;
    Object.keys(ruleType).forEach(otherId => {
      if (ruleType[otherId] !== undefined) {
        onAddRule(gameId, modId, {
          reference: this.makeReference(mods[otherId]),
          type: ruleType[otherId],
        });
      } else {
        const origTypes = this.getRuleTypes(modId, mods, conflicts);
        onRemoveRule(gameId, modId, {
          reference: this.makeReference(mods[otherId]),
          type: origTypes[otherId],
        });
      }
    });

    this.close();
  }
}

const emptyObj = {};
const emptyArr = [];

function mapStateToProps(state): IConnectedProps {
  const dialog = state.session.dependencies.conflictDialog || {};
  return {
    gameId: dialog.gameId,
    modId: dialog.modId,
    conflicts: dialog.modId !== undefined
      ? state.session.dependencies.conflicts[dialog.modId]
      : emptyArr,
    mods: dialog.gameId !== undefined ? state.persistent.mods[dialog.gameId] : emptyObj,
    modRules: dialog.modRules,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onClose: () => dispatch(setConflictDialog()),
    onAddRule: (gameId, modId, rule) =>
      dispatch(nmmActions.addModRule(gameId, modId, rule)),
    onRemoveRule: (gameId, modId, rule) =>
      dispatch(nmmActions.removeModRule(gameId, modId, rule)),
  };
}

export default translate(['common', 'dependency-manager'], {wait: false})(
  connect(mapStateToProps, mapDispatchToProps)(
  ConflictEditor)) as React.ComponentClass<{}>;
