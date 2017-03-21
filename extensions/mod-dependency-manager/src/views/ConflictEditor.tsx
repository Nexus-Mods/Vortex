import { IConflict } from '../types/IConflict';
import renderModName from '../util/renderModName';

import { setConflictDialog } from '../actions';

import { ComponentEx, types } from 'nmm-api';
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
}

type IProps = IConnectedProps & IActionProps;

/**
 * editor displaying mods that conflict with the selected one
 * and offering a quick way to set up rules between them
 * 
 * @class ConflictEditor
 * @extends {ComponentEx<IProps, {}>}
 */
class ConflictEditor extends ComponentEx<IProps, {}> {
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

  private renderConflict = (conflict: IConflict) => {
    const {t, modId, mods} = this.props;
    const popover = <Popover
      className='conflict-popover'
      id={`conflict-popover-${conflict.otherMod}`}
    >
      { conflict.files.map(fileName => <p key={fileName}>{fileName}</p>) }
    </Popover>;

    return (<ListGroupItem key={conflict.otherMod}>
      <FormControl
        className='conflict-rule-select'
        componentClass='select'
        value={undefined}
        onChange={this.setRuleType}
      >
        <option value={undefined}>{t('No rule')}</option>
        <option value='before'>{t('Load before')}</option>
        <option value='after'>{t('Load after')}</option>
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

  private setRuleType = () => {

  }

  private save = () => {
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
  }
}

export default translate(['common', 'dependency-manager'], {wait: false})(
  connect(mapStateToProps, mapDispatchToProps)(
  ConflictEditor
)
) as React.ComponentClass<{}>;
