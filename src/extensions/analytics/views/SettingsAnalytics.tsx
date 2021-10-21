import * as React from 'react';
import { ControlLabel, FormGroup, HelpBlock } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { Toggle } from '../../..';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { setAnalytics } from '../reducers/analytics.action';

interface IConnectedProps {
  analytics: boolean;
  userInfo: any;
}

interface IActionProps {
  onSetAnalytics: (analytics: boolean) => void;
}

type IProps = IActionProps & IConnectedProps;

class SettingsUpdate extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, analytics, userInfo } = this.props;
    return (
      <form>
        <FormGroup controlId='analytics'>
          <ControlLabel>{t('Diagnostics and usage data')}</ControlLabel>
          <Toggle
            checked={analytics}
            onToggle={this.toggleAnalytics}
            disabled={!userInfo}
          >
            {t('Allow tracking')}
          </Toggle>
          <HelpBlock>
            {t('This information is sent to our team entirely anonymously and only with your express consent')}
            <a style={{ marginLeft: '4px' }} href='https://help.nexusmods.com/article/121-diagnostics-usage-data-vortex'>
              {t('More about the data we track.')}
            </a>
          </HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private toggleAnalytics = () => {
    this.props.onSetAnalytics(!this.props.analytics);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    analytics: state.settings.analytics.enabled,
    userInfo: state.persistent.nexus.userInfo,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetAnalytics: (analytics: boolean): void => {
      dispatch(setAnalytics(analytics));
    },
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsUpdate)) as React.ComponentClass<{}>;
