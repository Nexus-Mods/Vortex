import More from '../../controls/More';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import { setUpdateChannel } from './actions';
import getText from './texts';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import * as Redux from 'redux';

interface IConnectedProps {
  updateChannel: 'stable' | 'beta';
}

interface IActionProps {
  onSetUpdateChannel: (channel: 'stable' | 'beta') => void;
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
            <option value='beta'>{t('Beta')}</option>
          </FormControl>
        </FormGroup>
      </form>
    );
  }

  private selectChannel = (evt) => {
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    switch (target.value) {
      case 'stable': this.props.onSetUpdateChannel('stable'); break;
      case 'beta': this.props.onSetUpdateChannel('beta'); break;
      default: log('error', 'invalid channel', target.value);
    }
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    updateChannel: state.settings.update.channel,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
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
