import { setAutoEnable } from '../actions/settings';
import { NAMESPACE } from '../statics';
import { gameSupported } from '../util/gameSupport';

import * as React from 'react';
import { ControlLabel, FormGroup, HelpBlock } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ComponentEx, selectors, Toggle, types } from 'vortex-api';

export interface IBaseProps {
}

interface IConnectedProps {
  gameMode: string;
  autoEnable: boolean;
}

interface IActionProps {
  onSetAutoEnable: (enable: boolean) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, gameMode, autoEnable } = this.props;

    if (!gameSupported(gameMode)) {
      return null;
    }

    return (
      <form>
        <FormGroup controlId='default-enable'>
          <ControlLabel>{t('Plugins')}</ControlLabel>
          <Toggle
            checked={autoEnable}
            onToggle={this.toggle}
          >
            {t('Enable externally added plugins automatically')}
          </Toggle>
          <HelpBlock>
            {t('If checked, plugins you add to the game directory outside Vortex '
              + '(e.g. when you create one with the Creation Kit) will be enabled automatically.')}
          </HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private toggle = (enabled: boolean) => {
    const { onSetAutoEnable } = this.props;
    onSetAutoEnable(enabled);
  }
}

function mapStateToProps(state: types.IState): IConnectedProps {
  const gameMode = selectors.activeGameId(state);
  return {
    gameMode,
    autoEnable: (state.settings as any).plugins.autoEnable,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAutoEnable: (enable: boolean) => dispatch(setAutoEnable(enable)),
  };
}

export default
  withTranslation(['common', NAMESPACE])(
    connect(mapStateToProps, mapDispatchToProps)(Settings) as any,
  ) as React.ComponentClass<{}>;
