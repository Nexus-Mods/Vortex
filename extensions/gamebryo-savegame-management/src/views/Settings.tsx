import * as React from 'react';
import { ControlLabel, FormGroup, HelpBlock } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { ComponentEx, selectors, Toggle } from 'vortex-api';
import { enableMonitor } from '../actions/settings';
import { gameSupported } from '../util/gameSupport';

export interface IBaseProps {
  onToggled: () => void;
}

interface IConnectedProps {
  gameMode: string;
  monitorEnabled: boolean;
}

interface IActionProps {
  enableMonitor: (enabled: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, gameMode, monitorEnabled } = this.props;

    if (!gameSupported(gameMode)) {
      return null;
    }

    return (
      <form>
        <FormGroup controlId='redirection'>
          <ControlLabel>{t('Savegame folder monitoring')}</ControlLabel>
          <Toggle
            checked={monitorEnabled}
            onToggle={this.toggle}
          >
            {t('Monitor Savegame directory for changes')}
          </Toggle>
          <HelpBlock>
            {t('If your games take very long to save when Vortex is running, try disabling this.')}
          </HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private toggle = () => {
    this.props.enableMonitor(!this.props.monitorEnabled);
    this.props.onToggled();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state),
    monitorEnabled: state.settings.saves.monitorEnabled,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    enableMonitor: (enabled: boolean) => dispatch(enableMonitor(enabled)),
  };
}

export default withTranslation(['default', 'gamebryo-savegames'])(
  connect(mapStateToProps, mapDispatchToProps)(Settings) as any);
