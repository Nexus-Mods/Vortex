import {ITestResult, ProblemSeverity} from '../../../types/ITestResult';
import {ComponentEx} from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as React from 'react';
import {Alert, Button} from 'react-bootstrap';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  problemId: string;
  problem: ITestResult;
  onResolveProblem: (id: string) => void;
}

type IProps = IBaseProps;

interface IComponentState {
  fixRunning: boolean;
}

class ProblemMessage extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);

    this.initState({ fixRunning: false });
  }

  public shouldComponentUpdate() {
    return true;
  }

  public render(): JSX.Element {
    const {t, problem} = this.props;
    const style = this.styleFrom(problem.severity);

    const lines = problem.description.long.split('\n')
      .map((line, idx) => <span key={idx}>{t(line)}<br/></span>);

    return (
      <Alert className='problem-alert' bsStyle={style}>
        <h4>{t(problem.description.short)}</h4>
        <p className='hover-expand'>{lines}</p>
        <p>{this.renderFixButton(problem.automaticFix)}</p>
      </Alert>
    );
  }

  private renderFixButton(fixFunction?: () => Promise<void>) {
    const {t} = this.props;
    const { fixRunning } = this.state;
    if (fixFunction === undefined) {
      return null;
    }

    return (fixRunning
      ? <Icon name='spinner' pulse />
      : (
        <Button onClick={this.startFix}>
          {t('Fix')}
        </Button>
      )
    );
  }

  private startFix = () => {
    const {problem, problemId, onResolveProblem} = this.props;
    this.nextState.fixRunning = true;

    problem.automaticFix()
      .then(() => onResolveProblem(problemId))
      .catch((err) => {
        this.context.api.showErrorNotification('failed to fix problem', err);
      })
      .finally(() => {
        this.nextState.fixRunning = false;
      });
  }

  private styleFrom(severity: ProblemSeverity): string {
    return severity === 'warning' ? 'warning' : 'danger';
  }
}

export default ProblemMessage as React.ComponentClass<IBaseProps>;
