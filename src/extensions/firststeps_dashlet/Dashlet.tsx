import { II18NProps } from '../../types/II18NProps';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import { activeGameId, basePath } from '../../util/selectors';
import Icon from '../../views/Icon';
import { IconButton } from '../../views/TooltipControls';

import { setAssociatedWithNXMURLs } from '../nexus_integration/actions/settings';

import { dismissStep } from './actions';

import * as React from 'react';
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap';
import { Interpolate } from 'react-i18next';

export interface IBaseProps {}

interface IConnectedState {
  gameMode: string;
  basePath: string;
  associatedWithNXM: boolean;
  dismissAll: boolean;
  steps: { [stepId: string]: boolean };
}

interface IActionProps {
  onAssociateNXM: (associated: boolean) => void;
  onDismissStep: (step: string) => void;
}

type IProps = IBaseProps & IConnectedState & IActionProps & II18NProps;

interface IToDo {
  id: string;
  condition: (props: IProps) => boolean;
  render: (props: IProps) => JSX.Element;
}

class Dashlet extends ComponentEx<IProps, {}> {

  private todos: IToDo[] = [
    {
      id: 'pick-game',
      condition: (props: IProps) => props.gameMode === undefined,
      render: (props: IProps): JSX.Element => {
        const {t} = props;
        const link = <a onClick={this.openGames}><Icon name='gamepad'/>{t('Games')}</a>;

        return (<span>
          <Interpolate
            i18nKey='Open {{link}} to select a game to manage'
            link={link}
          />
          </span>);
      },
    },
    {
      id: 'paths',
      condition: (props: IProps) => props.gameMode !== undefined,
      render: (props: IProps): JSX.Element => {
        const {t, basePath} = props;
        const path = <strong>{basePath}</strong>;
        const link = <a onClick={this.openSettings}><Icon name='gear'/>{t('Settings')}</a>;

        return (<span>
          <Interpolate
            i18nKey='Data for this game will be stored in {{path}}\nOpen {{link}} to change'
            path={path}
            link={link}
          />
        </span>);
      },
    },
    {
      id: 'nxm-associated',
      condition: (props: IProps) => !props.associatedWithNXM,
      render: (props: IProps): JSX.Element => {
        const {t} = props;
        return (<span>
          {t('Do you want NMM2 to handle download links on Nexus?')}
          {' '}<Button onClick={this.associateNXM}>{t('Associate')}</Button>
          </span>);
      },
    },
  ];

  public render(): JSX.Element {
    const { t, dismissAll, steps } = this.props;

    if (dismissAll) {
      return null;
    }

    const visibleSteps = this.todos.filter(
      (step) => !steps[step.id] && step.condition(this.props)
      );

    return (<ListGroup>
      {visibleSteps.map((step) =>
        <ListGroupItem key={step.id}>
          {step.render(this.props)}
          <IconButton
            id={`btn-dismiss-${step.id}`}
            icon='remove'
            tooltip={t('Dismiss')}
            className='close-button btn-embed'
            value={step.id}
            onClick={this.dismiss}
          />
        </ListGroupItem>) }
    </ListGroup>);
  }

  private openSettings = () => {
    this.context.api.events.emit('show-modal', 'settings');
  }

  private openGames = () => {
    this.context.api.events.emit('show-main-page', 'Games');
  }

  private associateNXM = () => {
    this.props.onAssociateNXM(true);
  }

  private dismiss = (evt: React.MouseEvent<any>) => {
    let stepId = evt.currentTarget.value;
    this.props.onDismissStep(stepId);
  }
}

function mapStateToProps(state: any): IConnectedState {
  return {
    gameMode: activeGameId(state),
    basePath: basePath(state),
    associatedWithNXM: state.settings.nexus.associateNXM,
    dismissAll: state.settings.firststeps.dismissAll,
    steps: state.settings.firststeps.steps,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAssociateNXM: (associated: boolean) => dispatch(setAssociatedWithNXMURLs(associated)),
    onDismissStep: (step: string) => dispatch(dismissStep(step)),
  };
}

export default translate(['common'], { wait: true })(
  connect(mapStateToProps, mapDispatchToProps)(
    Dashlet)
  ) as React.ComponentClass<IBaseProps>;
