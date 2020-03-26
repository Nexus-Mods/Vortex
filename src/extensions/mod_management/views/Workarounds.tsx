import Toggle from '../../../controls/Toggle';
import { IState } from '../../../types/IState';
import { ComponentEx } from '../../../util/ComponentEx';
import { setCleanupOnDeploy } from '../actions/settings';

import * as React from 'react';
import { ControlLabel, FormGroup, HelpBlock } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps {
}

interface IConnectedProps {
  cleanupOnDeploy: boolean;
}

interface IActionProps {
  onSetCleanupOnDeploy: (enable: boolean) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, cleanupOnDeploy } = this.props;

    return (
      <form>
        <FormGroup controlId='cleanup-on-deploy'>
          <ControlLabel>{t('Clean up empty directories ')}</ControlLabel>
          <Toggle
            checked={cleanupOnDeploy}
            onToggle={this.toggle}
          >
            {t('Clean up empty directories during deployment')}
          </Toggle>
          <HelpBlock>
            {t('By default Vortex will only remove empty directories during deployment '
              + 'if the game or related tools would otherwise not work correctly.\n'
              + 'Usually empty directories cause no harm and cleaning them up takes '
              + 'some extra time during deployment so '
              + 'we advise you only enable this option if you\'re experience problems we didn\'t '
              + 'anticipate. In that case please also inform us.')}
          </HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private toggle = (enabled: boolean) => {
    const { onSetCleanupOnDeploy } = this.props;
    onSetCleanupOnDeploy(enabled);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    cleanupOnDeploy: state.settings.mods.cleanupOnDeploy,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetCleanupOnDeploy: (enable: boolean) => dispatch(setCleanupOnDeploy(enable)),
  };
}

export default
  withTranslation(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(Settings) as any,
  ) as React.ComponentClass<{}>;
