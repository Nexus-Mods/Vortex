import More from '../../controls/More';
import { UPDATE_CHANNELS, UpdateChannel, IState } from '../../types/IState';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import { setUpdateChannel } from './actions';
import getText from './texts';

import { ipcRenderer } from 'electron';
import * as React from 'react';
import { Alert, Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import VortexInstallType from '../../types/VortexInstallType';

interface IConnectedProps {
  updateChannel: UpdateChannel;
  installType: VortexInstallType;
}

interface IActionProps {
  onSetUpdateChannel: (channel: UpdateChannel) => void;
}

type IProps = IActionProps & IConnectedProps;

class SettingsUpdate extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, installType, updateChannel } = this.props;

    const renderDevelopmentAlert = () => {
      if(process.env.NODE_ENV === 'development')
         return (
          <div>
          <ControlLabel>
            <Alert>
              {t('Vortex is running in development mode and version will always remain at 0.0.1. Updates will be checked but they won\'t be downloaded or installed.')}
            </Alert>
          </ControlLabel>
          </div>
        );
      return null;
    }

    const renderPreviewAlert = () => {
      if(updateChannel === 'next')
         return (
          <div>
          <ControlLabel>
            <Alert>
              {t('Vortex is running in preview mode and using the hidden \'next\' update channel.')}
            </Alert>
          </ControlLabel>
          </div>
        );
      return null;
    }

    // managed or development
    if (installType === 'managed') {

      // managed and not development
      if(process.env.NODE_ENV !== 'development') {
        return (
          <ControlLabel>
            <Alert>
              {t('Vortex was installed through a third-party service which will take care of updating it.')}
            </Alert>
          </ControlLabel>
        );
      }
      
      // managed and development
             
    }

    // regular
    return (
    <form>
        <FormGroup controlId='updateChannel'>

          <ControlLabel>
            {t('Update')}
            <More id='more-update-channel' name={t('Update Channel')}>
              {getText('update-channel', t)}
            </More>
          </ControlLabel> 

          <FormControl
            componentClass='select'
            onChange={this.selectChannel}
            value={updateChannel}
          >
            <option value='stable'>{t('Stable')}</option>
            <option value='beta'>{t('Beta')}</option>
            <option value='none'>{t('No automatic updates')}</option>
          </FormControl>

          { renderPreviewAlert() }

          { renderDevelopmentAlert() }
          
          <ControlLabel>
            {updateChannel === 'none' ? [(
              <Alert key='manual-update-warning' bsStyle='warning'>
                {t('Very old versions of Vortex will be locked out of network features eventually '
                  + 'so please do keep Vortex up-to-date.')}
              </Alert>
            ), (<Button key='manual-update-button' onClick={this.checkNow}>
              {t('Check now')}
            </Button>)] : null}
          </ControlLabel>
        </FormGroup>
      </form>
    );
  }

  private checkNow = () => {
    // send what updateChannel you are on, unless it's none, then send stable
    ipcRenderer.send('check-for-updates', this.props.updateChannel === 'none' ? 'stable' : this.props.updateChannel);
  }

  private selectChannel = (evt) => {
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    if (UPDATE_CHANNELS.includes(target.value as UpdateChannel)) {
      this.props.onSetUpdateChannel(target.value as UpdateChannel);
    } else {
      log('error', 'invalid channel', target.value);
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    updateChannel: state.settings.update.channel,
    installType: state.app.installType,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetUpdateChannel: (channel: UpdateChannel): void => {
        dispatch(setUpdateChannel(channel));
    },
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsUpdate)) as React.ComponentClass<{}>;
