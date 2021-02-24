import { showDialog } from '../../actions/notifications';
import Toggle from '../../controls/Toggle';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../types/IDialog';
import { IState } from '../../types/IState';
import { ComponentEx } from '../../util/ComponentEx';

import { enableUserSymlinks } from './actions';

import Promise from 'bluebird';
import * as React from 'react';
import { Alert, ControlLabel, FormGroup, HelpBlock } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps {
  supported: string;
  onSymlinksPrivilege: (enable: boolean) => void;
  localState: { symlinkRight: boolean };
}

interface IConnectedProps {
  userSymlinks: boolean;
}

interface IActionProps {
  onEnableUserSymlinks: (enable: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  private mInitialSymlinkPrivilege: boolean;
  public componentDidMount() {
    this.props.localState['attach']?.(this);
    this.mInitialSymlinkPrivilege = this.props.localState.symlinkRight;
  }

  public componentWillUnmount() {
    this.props.localState['detach']?.(this);
  }

  public render(): JSX.Element {
    const { t, supported, localState, userSymlinks } = this.props;

    return (
      <form>
        <FormGroup controlId='no-elevation-symlink'>
          <ControlLabel>{t('Symlinks')}</ControlLabel>
          <Toggle
            checked={localState.symlinkRight}
            onToggle={this.togglePriv}
            disabled={supported !== null}
          >
            {t('Allow Symlinks without elevation (experimental!)')}
          </Toggle>
          {(this.mInitialSymlinkPrivilege !== localState.symlinkRight) ? (
            <Alert>
              {t('You have to log out the user account or reboot windows for this change to be '
                 + 'applied.')}
            </Alert>
          ) : (null)}
          <Toggle
            checked={userSymlinks}
            onToggle={this.toggle}
            disabled={supported !== null}
          >
            {t('Allow Symlinks without elevation (old mechanism, pre Vortex v1.4.3)')}
          </Toggle>
          {(supported !== null) ? (
            <Alert>
              {t('This feature doesn\'t seem to be supported on your system: {{reason}}', {
                 replace: { reason: supported }})}
            </Alert>
          ) : null}
        </FormGroup>
      </form>
    );
  }

  private togglePriv = (enabled: boolean) => {
    const { onSymlinksPrivilege, onShowDialog } = this.props;
    const text = enabled
      ? 'This will give your windows account the right to create symlinks. '
          + 'You will have to log out or restart your computer for this change to take effect.\n'
          + '\nAre there drawbacks? This is supposedly disabled by default for security reasons '
          + 'but\na) It\'s certainly not safer for us to constantly have to elevate a process '
          + '\nb) Windows lets any account create hard-links, why would symlinks be more '
          + 'of a security problem?\n'
          + 'So as far as I can tell, this is a win-win.'
      : 'This will strip your windows account of the right to create symlinks globally! '
          + 'You will have to log out or restart your computer for this change to take effect.\n';
    onShowDialog('info', 'Enable Symlinks without elevation', {
      text,
    }, [
      { label: 'Cancel' },
      { label: enabled ? 'Give Privilege' : 'Remove Privilege' },
    ])
    .then(result => {
      if (result.action !== 'Cancel') {
        onSymlinksPrivilege(enabled);
      }
    });
  }

  private toggle = (enabled: boolean) => {
    const { onEnableUserSymlinks, onShowDialog } = this.props;
    if (enabled) {
      onShowDialog('info', 'Enable Symlinks without elevation', {
        text: 'You have two ways to get rid of the need to confirm the UAC dialog whenever you '
          + 'deploy mods, both have drawbacks!\nFirst, you can go to '
          + 'windows Settings -> "Update & Security" -> "For developers" '
          + 'and enable "Developer Mode". This will however also install some software and '
          + 'services that you don\'t actually need as a regular user. If you want to go '
          + 'this route you should cancel now, quit Vortex and restart after enabling '
          + '"Developer Mode".\n'
          + 'The other option is for Vortex to set up a global task in windows that has '
          + 'the increased permissions and can be triggered by your regular account. '
          + 'You\'d only have to confirm the UAC dialog once (every time you toggle this '
          + 'setting). The drawback is that this might be a security risk if anyone gets '
          + 'control of your windows account.',
      }, [
        { label: 'Cancel' },
        { label: 'Create Task' },
      ])
      .then((result: IDialogResult) => {
        if (result.action === 'Create Task') {
          onEnableUserSymlinks(enabled);
        }
      });
    } else {
      onEnableUserSymlinks(enabled);
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    userSymlinks: state.settings.workarounds.userSymlinks,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onEnableUserSymlinks: (enable: boolean) => dispatch(enableUserSymlinks(enable)),
    onShowDialog: (type: DialogType, title: string,
                   content: IDialogContent, actions: DialogActions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  withTranslation(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(Settings) as any,
  ) as React.ComponentClass<{}>;
