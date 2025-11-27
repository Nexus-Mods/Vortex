import { setAutoRun } from './actions';

import I18next from 'i18next';
import * as React from 'react';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { More, Toggle, types } from 'vortex-api';

interface IBaseProps {
  t: typeof I18next.t;
}

interface IConnectedProps {
  autoRun: boolean;
}

interface IActionProps {
  onEnableautoRun: (enable: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

function Settings(props: IProps) {
  const { t, autoRun, onEnableautoRun } = props;
  return (
    <div>
      <Toggle
        checked={autoRun}
        onToggle={onEnableautoRun}
      >
        {t('Run FNIS on Deployment Event (if necessary)')}
        <More id='fnis-setting' name={t('Running FNIS automatically')}>
          {t('Any time you deploy, Vortex will check if any mod containing animations '
            + 'has changed. If so, it will run FNIS and create or update a mod named "FNIS Data". '
            + 'This mod contains the animations generated for your system based on your mod loadout '
            + 'and it is supposed to load after all mods containing animations. '
            + 'This should get set up automatically.\n\n'
            + 'Important: If FNIS produces an error message it will still open a window and the '
            + 'deployment will be paused until you close FNIS.')}
        </More>
      </Toggle>
    </div>
  );
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    autoRun: state.settings.fnis.autoRun,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<types.IState, null, Redux.Action>)
    : IActionProps {
  return {
    onEnableautoRun: (enable: boolean) => dispatch(setAutoRun(enable)),
  };
}

export default 
  withTranslation(['common', 'fnis-integration'])(
    connect(mapStateToProps, mapDispatchToProps)(
      Settings) as any) as React.ComponentClass<{}>;
