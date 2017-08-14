import { IState } from '../../../types/IState';
import { ComponentEx } from '../../../util/ComponentEx';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';
import { IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import { setModEnabled } from '../actions/profiles';
import { closeDialog } from '../actions/transferSetup';
import { IProfile } from '../types/IProfile';

import * as React from 'react';
import { Button, Checkbox, FormControl, Modal } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

interface IDialog {
  gameId: string;
  source: string;
  target: string;
}

interface IConnectedProps {
  dialog: IDialog;
  mods: { [key: string]: IMod };
  profiles: { [key: string]: IProfile };
}

interface IActionProps {
  onCloseDialog: () => void;
  onSetModEnabled: (profileId: string, modId: string, enabled: boolean) => void;
}

interface IComponentState {
  dialog: IDialog;
  transferEnabledMods: boolean;
}

type IProps = IConnectedProps & IActionProps;

/**
 * simple dialog to set userlist rule between two plugins
 *
 * @class Editor
 * @extends {ComponentEx<IProps, IComponentState>}
 */
class Editor extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      dialog: undefined,
      transferEnabledMods: true,
    });
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.dialog !== this.props.dialog) {
      this.nextState.dialog = nextProps.dialog;
    }
  }

  public render(): JSX.Element {
    const { t, profiles } = this.props;
    const { dialog } = this.state;

    return (
      <Modal show={dialog !== undefined} onHide={this.close}>
        {dialog !== undefined
          ? (
            <Modal.Body>
            <div>
              <FormControl.Static>
                {t('From: {{source}}', { replace: { source: profiles[dialog.source].name } })}
              </FormControl.Static>
              <IconButton
                id='btn-swap-profiles'
                icon='swap-horizontal'
                tooltip={t('Swap profiles')}
                onClick={this.swapProfiles}
              />
              <FormControl.Static>
                {t('To: {{target}}', { replace: { target: profiles[dialog.target].name } })}
              </FormControl.Static>
            </div>
            <Checkbox
              checked={this.state.transferEnabledMods}
              onChange={this.toggleTransferEnabled}
            >
              {t('Transfer Enabled Mods')}
            </Checkbox>
          </Modal.Body>)
          : null}
        <Modal.Footer>
          <Button onClick={this.close}>{t('Cancel')}</Button>
          <Button onClick={this.apply}>{t('Transfer')}</Button>
        </Modal.Footer>
      </Modal>);
  }

  private swapProfiles = () => {
    const temp = this.nextState.dialog.source;
    this.nextState.dialog.source = this.nextState.dialog.target;
    this.nextState.dialog.target = temp;
  }

  private changeSource = (event) => {
    this.nextState.dialog.source = event.currentTarget.value;
  }

  private toggleTransferEnabled = () => {
    this.nextState.transferEnabledMods = !this.state.transferEnabledMods;
  }

  private changeTarget = (event) => {
    this.nextState.dialog.target = event.currentTarget.value;
  }

  private apply = () => {
    const { mods, onSetModEnabled, profiles } = this.props;
    const { dialog } = this.state;
    Object.keys(mods).forEach(modId => {
      onSetModEnabled(dialog.target, modId,
        getSafe(profiles, [dialog.source, 'modState', modId, 'enabled'], false));
    });
    this.close();
  }

  private close = () => {
    this.props.onCloseDialog();
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  const dialog: IDialog = (state.session as any).profileTransfer.dialog;
  return {
    dialog,
    profiles: state.persistent.profiles,
    mods: dialog !== undefined ? state.persistent.mods[dialog.gameId] : undefined,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onCloseDialog: () => dispatch(closeDialog()),
    onSetModEnabled: (profileId: string, modId: string, enabled: boolean) =>
      dispatch(setModEnabled(profileId, modId, enabled)),
  };
}

export default translate(['common', 'profile-management'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(Editor)) as React.ComponentClass<{}>;
