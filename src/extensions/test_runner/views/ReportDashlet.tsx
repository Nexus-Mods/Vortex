import {ITestResult} from '../../../types/ITestResult';
import {ComponentEx} from '../../../util/ComponentEx';

import ProblemMessage from './ProblemMessage';

import * as React from 'react';
import {ListGroup} from 'react-bootstrap';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  problems: { [id: string]: ITestResult };
  onResolveProblem: (id: string) => void;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps;

/**
 * dashlet to display problems that were discovered in the current
 * setup
 */
class ReporterDashlet extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const {problems} = this.props;

    return (<ListGroup>
      {Object.keys(problems).map(this.renderProblem)}
      </ListGroup>);
  }

  private renderProblem = (problemId: string): JSX.Element => {
    const {problems} = this.props;

    const problem = problems[problemId];

    return <ProblemMessage
      key={problemId}
      problemId={problemId}
      problem={problem}
      onResolveProblem={this.resolveProblem}
    />;
  }

  private resolveProblem = (problemId: string) => {
    this.props.onResolveProblem(problemId);
  }
}

export default ReporterDashlet as React.ComponentClass<IBaseProps>;

