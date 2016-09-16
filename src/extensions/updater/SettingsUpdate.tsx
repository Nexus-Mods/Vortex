import { II18NProps } from '../../types/II18NProps';
import { log } from '../../util/log';
import { setUpdateChannel } from './actions';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

interface IConnectedProps {
  updateChannel: 'stable' | 'beta';
}

interface IActionProps {
  onSetUpdateChannel: (channel: 'stable' | 'beta') => void;
}

class SettingsUpdateBase extends React.Component<IActionProps & IConnectedProps & II18NProps, {}> {
  public render(): JSX.Element {
    const { t, updateChannel } = this.props;

    return (
      <form>
        <FormGroup controlId='languageSelect'>
          <ControlLabel>{t('Update') }</ControlLabel>
          <FormControl componentClass='select' onChange={ this.selectChannel } value={updateChannel}>
            <option value='stable'>{ t('Stable') }</option>
            <option value='beta'>{ t('Beta') }</option>
          </FormControl>
        </FormGroup>
      </form>
    );
  }

  private selectChannel = (evt) => {
    let target: HTMLSelectElement = evt.target as HTMLSelectElement;
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

function mapDispatchToProps(dispatch: Function): IActionProps {
  return {
    onSetUpdateChannel: (channel: 'stable' | 'beta'): void => {
        dispatch(setUpdateChannel(channel));
    },
  };
}

const SettingsUpdate = connect(mapStateToProps, mapDispatchToProps)(SettingsUpdateBase);

export default translate(['common'], { wait: true })(SettingsUpdate);
