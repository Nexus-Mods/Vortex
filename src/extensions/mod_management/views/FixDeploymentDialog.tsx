import Modal from '../../../controls/Modal';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { IDeploymentProblem, setDeploymentProblem } from '../actions/session';
import * as React from 'react';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { Button } from 'react-bootstrap';
import { getAllActivators } from '../util/deploymentMethods';
import { IDeploymentMethod } from '../../../types/api';
import allTypesSupported from '../util/allTypesSupported';
import { activeGameId } from '../../../util/selectors';
import { getGame } from '../../gamemode_management/util/getGame';
import getModPaths from '../util/getModPaths';
import { IUnavailableReason } from '../types/IDeploymentMethod';
import { Trans } from 'react-i18next';

export interface IFixDeploymentDialogProps {

}

interface IConnectedProps {
  problems: IDeploymentProblem[];
}

interface IActionProps {
  onClear: () => void;
}

type IProps = IFixDeploymentDialogProps & IConnectedProps & IActionProps;

interface IFixDeploymentDialogState {
  step: number;
}

function nop() {}

class FixDeploymentDialog extends ComponentEx<IProps, IFixDeploymentDialogState> {
  private deploymentMethods: IDeploymentMethod[];
  constructor(props: IProps) {
    super(props);
    
    this.initState({
      step: -1,
    });
    this.deploymentMethods = getAllActivators();
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.props.problems !== newProps.problems) {
      this.nextState.step = -1;
    }
  }

  public render() {
    const { t, problems } = this.props;
    const { step } = this.state;
    const automaticFix = step !== -1 && problems[step].hasAutomaticFix;
    return (
      <Modal id='fix-deployment-dialog' show={problems.length > 0} onHide={nop}>
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
      <Trans i18nKey='fix-deployment-instructions'>
        Vortex supports different Deployment Method to support a wide variety of systems and games, but some may only be available with the right settings.
        <br/>
        Right now, none of the available deployment methods seem to be usable, but this is usually easy to fix.
        <br/>
        On the following screens we will offer possible solutions, simplest one first.
      </Trans>
    );
  }

  private renderFixPage() {
    const { t, problems } = this.props;
    const { step } = this.state;

    const method = this.deploymentMethods.find(method => method.id === problems[step].activator);

    return (
      <div>
        <h3>{method.name}</h3>
        <h5>{t('Problem')}</h5>
        <div>{problems[step].message}</div>
        <h5>{t('Solution')}</h5>
        <div>{(problems[step].solution !== undefined) ? problems[step].solution : t('Can\'t be solved.')}</div>
      </div>
    );
  }

  private applyFix = () => {
    const { problems, onClear } = this.props;
    const { step } = this.state;
    const method = this.deploymentMethods.find(iter => iter.id === problems[step].activator);
    const state = this.context.api.store.getState();

    const gameId = activeGameId(state);
    const modPaths = getModPaths(state, gameId);
    const reason: IUnavailableReason = allTypesSupported(method, state, gameId, Object.keys(modPaths));
    onClear();
    return reason.fixCallback(this.context.api);
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
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onClear: () => dispatch(setDeploymentProblem([])),
  };
}

export default translate(['common'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(FixDeploymentDialog),
) as React.ComponentClass<IFixDeploymentDialogProps>;
