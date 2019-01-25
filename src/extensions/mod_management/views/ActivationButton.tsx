import ToolbarIcon from '../../../controls/ToolbarIcon';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import onceCB from '../../../util/onceCB';
import { activeGameId, needToDeploy } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { IDeploymentMethod } from '../types/IDeploymentMethod';
import { NoDeployment } from '../util/exceptions';

import * as React from 'react';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

interface IConnectedProps {
  activator: IDeploymentMethod;
  needToDeploy: boolean;
}

interface IActionProps {
  onShowError: (message: string, details?: string, allowReport?: boolean) => void;
}

export interface IBaseProps {
  buttonType: 'text' | 'icon' | 'both';
  activators: IDeploymentMethod[];
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

const nop = () => undefined;

class ActivationButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, activator, needToDeploy } = this.props;

    return (
      <ToolbarIcon
        id='deploy-mods'
        icon='deploy'
        text={t('Deploy Mods')}
        className={needToDeploy ? 'need-to-deploy' : 'no-deploy'}
        onClick={activator !== undefined ? this.activate : nop}
        disabled={activator === undefined}
      />
    );
  }

  private activate = () => {
    this.context.api.events.emit('deploy-mods', onceCB((err) => {
      if (err !== null) {
        if (err instanceof NoDeployment) {
          this.props.onShowError(
            'You need to select a deployment method in settings',
            undefined, false);
        } else {
          this.props.onShowError('Failed to activate mods', err);
        }
      }
    }));
  }
}

function mapStateToProps(state: IState, ownProps: IProps): IConnectedProps {
  const gameId = activeGameId(state);
  const activatorId = getSafe(state, ['settings', 'mods', 'activator', gameId], undefined);
  let activator: IDeploymentMethod;
  if (activatorId !== undefined) {
    activator = ownProps.activators.find((act: IDeploymentMethod) => act.id === activatorId);
  }
  return {
    activator,
    needToDeploy: needToDeploy(state),
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<IState, null, Redux.Action>): IActionProps {
  return {
    onShowError: (message: string, details?: string, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(ActivationButton),
  ) as React.ComponentClass<IBaseProps>;
