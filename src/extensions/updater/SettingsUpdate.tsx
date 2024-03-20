import More from '../../controls/More';
import { UPDATE_CHANNELS, UpdateChannel, IState } from '../../types/IState';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import { setUpdateChannel } from './actions';

import { ipcRenderer } from 'electron';
import * as React from 'react';
import { Alert, Button, ControlLabel, FormControl, FormGroup, InputGroup } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import VortexInstallType from '../../types/VortexInstallType';
import { MainContext, util } from 'vortex-api';

interface IConnectedProps {
  updateChannel: UpdateChannel;
  installType: VortexInstallType;
}

interface IActionProps {
  onSetUpdateChannel: (channel: UpdateChannel) => void;
}

interface ISettingsUpdateState {
  checkUpdateButtonDisabled: boolean;
}

type IProps = IActionProps & IConnectedProps;

const CHECK_UPDATE_INTERVAL = 60000;
class SettingsUpdate extends ComponentEx<IProps, ISettingsUpdateState> {
  
  //static contextType = MainContext 

  constructor(props) {
    super(props);

    this.initState({
      checkUpdateButtonDisabled: false
    });
  }

  private checkUpdateDebouncer = new util.Debouncer(() => {

    this.checkNow();

    setTimeout(() => {
      this.nextState.checkUpdateButtonDisabled = false;
    }, CHECK_UPDATE_INTERVAL);

    return null;
  }, CHECK_UPDATE_INTERVAL, true, true);  

  private manualUpdateCheck = () => {
    this.nextState.checkUpdateButtonDisabled = true;
    log('info', 'manual update check');
    this.checkUpdateDebouncer.schedule();    
  }

  public render(): JSX.Element {

    const { t, installType, updateChannel } = this.props;

    const { checkUpdateButtonDisabled } = this.state;

    const renderDevelopmentAlert = () => {
      if(process.env.NODE_ENV === 'development')
         return (
          <div>
          <ControlLabel>
            <Alert>
              {t('Vortex is running in development mode. Updates will be checked and downloaded but can\'t be installed.')}
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
          <div>
          <ControlLabel>
            <Alert>
              {t('Vortex was installed through a third-party service which will take care of updating it.')}
            </Alert>
          </ControlLabel>
          </div>
        );
      }
      
      // managed and development
             
    }

    // regular
    return (
    <form>
        <FormGroup controlId='updateChannel'>

          { renderDevelopmentAlert() }

          <ControlLabel>
            {t('Update')}
            <More id='more-update-channel' name={t('Update Channel')}>
              {t('You can choose to either receive automatic updates only after they went through some '
      + 'community testing (Stable) or to always get the newest features (Beta). Manual checking for updates is '
      + 'restricted to every 10 minutes.')}
            </More>
          </ControlLabel> 

          <InputGroup>

            <FormControl
              componentClass='select'
              onChange={this.selectChannel}
              value={updateChannel}
            >
              <option value='stable'>{t('Stable')}</option>
              <option value='beta'>{t('Beta')}</option>
              <option value='none'>{t('No automatic updates')}</option>
            </FormControl>

            <Button disabled={checkUpdateButtonDisabled} key='manual-update-button' onClick={this.manualUpdateCheck}>
              {t('Check now')}
            </Button>

          </InputGroup>

          { renderPreviewAlert() }
          
          <div>
          <ControlLabel>
            {updateChannel === 'none' ? (
              <Alert key='manual-update-warning' bsStyle='warning'>
                {t('Very old versions of Vortex will be locked out of network features eventually '
                  + 'so please do keep Vortex up-to-date.')}
              </Alert>
            ) : null}
          </ControlLabel>
          </div>
        </FormGroup>
      </form>
    );
  }



  private checkNow = () => {    

    // send what updateChannel you are on, unless it's none, then send stable. manual check as well
    ipcRenderer.send('check-for-updates', this.props.updateChannel === 'none' ? 'stable' : this.props.updateChannel, true);
  }

  private selectChannel = (evt) => {
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    if (UPDATE_CHANNELS.includes(target.value as UpdateChannel)) {

      const newChannel = target.value as UpdateChannel

      if(newChannel === 'beta') {

        this.context.api.showDialog('question', 'Switching to Beta update channel', {          
          text: `Development versions of Vortex can be unstable and cause irrepairable damage to your modding environment. 

We recommend using the Beta channel only if you are comfortable with the risks and are willing to report any issues you encounter. We don't recommend downgrading back from beta to stable.

Are you sure you want to switch to the Beta update channel?`
        }, [ 
          { label: 'Cancel' },
          { label: 'Switch to Beta', action: () => 
            this.props.onSetUpdateChannel(newChannel)
          },
        ]);

      } else if (newChannel === 'stable') {
        // stable or latest
        this.props.onSetUpdateChannel(newChannel);

      } else if (newChannel === 'none'){
        // none

        this.context.api.showDialog('question', 'Turning off updates', {
          text: `This will stop notifications about Vortex updates.

This is not recommended as important security and stability updates are released regularly.

Are you sure you want to turn off updates?`
        }, [ 
          { label: 'Cancel' },
          { label: 'Turn off updates', action: () => 
            this.props.onSetUpdateChannel(newChannel)
          },
        ]);

      }
      
    } else {
      log('error', 'invalid channel', target.value);
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    updateChannel: state.settings.update.channel,
    installType: state.app.installType
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
