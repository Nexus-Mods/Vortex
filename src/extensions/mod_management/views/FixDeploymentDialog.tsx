import Modal from '../../../controls/Modal';
import { IDeploymentMethod } from '../../../types/api';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId, currentGameDiscovery, modPathsForGame } from '../../../util/selectors';
import { truthy } from '../../../util/util';
import { getGame } from '../../gamemode_management/util/getGame';
import { IDeploymentProblem, setDeploymentProblem } from '../actions/session';
import { IUnavailableReason } from '../types/IDeploymentMethod';
import allTypesSupported from '../util/allTypesSupported';
import { getAllActivators } from '../util/deploymentMethods';

import * as React from 'react';
import { Button } from 'react-bootstrap';
import { Trans } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { log } from '../../../util/log';

export interface IFixDeploymentDialogProps {

}

interface IConnectedProps {
  problems: IDeploymentProblem[];
  gameId: string;
}

interface IActionProps {
  onClear: () => void;
}

type IProps = IFixDeploymentDialogProps & IConnectedProps & IActionProps;

interface IFixDeploymentDialogState {
  step: number;
}

function nop() {
  // nop
}

class FixDeploymentDialog extends ComponentEx<IProps, IFixDeploymentDialogState> {
  private deploymentMethods: IDeploymentMethod[];
  constructor(props: IProps) {
    super(props);

    this.initState({
      step: -1,
    });
    this.deploymentMethods = getAllActivators();
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.problems !== newProps.problems) {
      this.nextState.step = -1;
    }
  }

  public render() {
    const { t, gameId, problems } = this.props;
    const { step } = this.state;
    const automaticFix = step !== -1 && problems[step].hasAutomaticFix;
    return (
      <Modal
        id='fix-deployment-dialog'
        show={gameId !== undefined && problems.length > 0}
        onHide={nop}
      >
        <Modal.Header>
          <Modal.Title>{t('Deployment Methods')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {step === -1 ? this.renderStartPage() : this.renderFixPage()}
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={this.cancel}
          >
            {t('Close')}
          </Button>
          <Button
            onClick={this.back}
            disabled={step <= 0}
          >
            {t('Back')}
          </Button>
          <Button
            onClick={this.applyFix}
            disabled={!automaticFix}
          >
            {t('Apply Fix')}
          </Button>
          <Button
            onClick={this.next}
            disabled={step >= problems.length - 1}
          >
            {t('Next')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderStartPage() {
    return (
      // tslint:disable:max-line-length
      <Trans i18nKey='fix-deployment-instructions'>
        Vortex supports different Deployment Method to support a wide variety of systems and games, but some may only be available with the right settings.
        <br/>
        Right now, none of the available deployment methods seem to be usable, but this is usually easy to fix.
        <br/>
        On the following screens we will offer possible solutions, simplest one first.
      </Trans>
      // tslint:enable:max-line-length
    );
  }

  private renderFixPage() {
    const { t, problems } = this.props;
    const { step } = this.state;

    const method = this.deploymentMethods.find(iter => iter.id === problems[step].activator);

    return (
      <div>
        <h3>{method.name}</h3>
        <h5>{t('Problem')}</h5>
        <div>{problems[step].message}</div>
        <h5>{t('Solution')}</h5>
        <div>
          {(problems[step].solution !== undefined)
            ? problems[step].solution
            : t('Can\'t be solved.')}
        </div>
      </div>
    );
  }

  private applyFix = () => {
    const { t, gameId, problems, onClear } = this.props;
    const { step } = this.state;
    const method = this.deploymentMethods.find(iter => iter.id === problems[step].activator);
    const state = this.context.api.store.getState();

    if (gameId === undefined) {
      // the dialog shouldn't have been shown if there is no game active
      return;
    }

    const modPaths = modPathsForGame(state, gameId);
    if (truthy(modPaths)) {
      // we have to find the unavailable reason again because the data we have doesn't contain
      // the actual fix function (since we can't put functions into the store)
      // However, it's technically possible that we find a different fail reason this time around
      // and that may not have a fix callback
      const reason = allTypesSupported(method, state, gameId, Object.keys(modPaths));
      if (reason.errors.length === 0) {
        // the failure no longer applies? Hrmm...
        log('warn', 'The reason the deployment method was unavailable was apparently temporary',
          { reason: method.description });
        onClear();
      } else if (reason.errors[0].fixCallback !== undefined) {
        onClear();
        return reason.errors[0].fixCallback(this.context.api);
      } else {
        onClear();
        this.context.api.sendNotification({
          type: 'warning',
          message: 'The reason this deployment method is unavaible has changed since the '
                 + 'notification was produced. This indicates a random or temporary factor '
                 + 'affecting it.',
        });
        log('warn', 'The reason the deployment method is unavailable changed',
          { before: method.description, after: reason.errors[0].description(t) });
      }
    } else {
      const discovery = currentGameDiscovery(state);
      this.context.api.showErrorNotification('Failed to apply fix', {
        gameId,
        activator: problems[step].activator,
        gameFound: getGame(gameId) !== undefined,
        discoveryFound: (discovery !== undefined) && (discovery.path !== undefined),
      });
      onClear();
    }
  }

  private cancel = () => {
    this.props.onClear();
  }

  private back = () => {
    this.nextState.step--;
  }

  private next = () => {
    this.nextState.step++;
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    problems: state.session.mods.deploymentProblems,
    gameId: activeGameId(state),
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onClear: () => dispatch(setDeploymentProblem([])),
  };
}

export default translate(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(FixDeploymentDialog),
) as React.ComponentClass<IFixDeploymentDialogProps>;
