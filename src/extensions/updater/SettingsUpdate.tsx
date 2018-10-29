import More from '../../controls/More';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import { setUpdateChannel } from './actions';
import getText from './texts';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

interface IConnectedProps {
  updateChannel: 'stable' | 'beta' | 'none';
}

interface IActionProps {
  onSetUpdateChannel: (channel: 'stable' | 'beta' | 'none') => void;
}

type IProps = IActionProps & IConnectedProps;

class SettingsUpdate extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, updateChannel } = this.props;
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
            <option value='beta'>{t('Testing')}</option>
            <option value='none'>{t('No automatic updates')}</option>
          </FormControl>
        </FormGroup>
      </form>
    );
  }

  private selectChannel = (evt) => {
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    if (['stable', 'beta', 'none'].indexOf(target.value) !== -1) {
      this.props.onSetUpdateChannel(target.value as any);
    } else {
      log('error', 'invalid channel', target.value);
    }
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    updateChannel: state.settings.update.channel,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetUpdateChannel: (channel: 'stable' | 'beta'): void => {
        dispatch(setUpdateChannel(channel));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsUpdate)) as React.ComponentClass<{}>;
