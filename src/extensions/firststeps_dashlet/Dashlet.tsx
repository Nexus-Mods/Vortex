import { setSettingsPage } from '../../actions/session';
import { IToDoButton, ToDoType } from '../../types/IExtensionContext';
import { II18NProps } from '../../types/II18NProps';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import * as selectors from '../../util/selectors';
import Icon from '../../views/Icon';
import More from '../../views/More';
import { IconButton } from '../../views/TooltipControls';

import { dismissStep } from './actions';
import { IToDo } from './IToDo';

import * as React from 'react';
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap';
import { Interpolate } from 'react-i18next';
import * as Redux from 'redux';

export interface IBaseProps {
  todos: IToDo[];
}

interface IConnectedState {
  dismissAll: boolean;
  steps: { [stepId: string]: boolean };
  extensionProps?: { [id: string]: any };
}

interface IActionProps {
  onDismissStep: (step: string) => void;
  onSetSettingsPage: (pageId: string) => void;
}

type IProps = IBaseProps & IConnectedState & IActionProps & II18NProps;

class Dashlet extends ComponentEx<IProps, {}> {
  constructor(inProps: IProps) {
    super(inProps);
  }

  public render(): JSX.Element {
    const { t, dismissAll, extensionProps, steps, todos } = this.props;

    if (dismissAll) {
      return null;
    }

    const visibleSteps = todos.filter(
      (step) => {
        if (steps[step.id]) {
          return false;
        }

        const props = step.props ? step.props(extensionProps[step.id]) : this.props;
        return step.condition(props);
      });

    visibleSteps.sort((lhs, rhs) => (lhs.priority || 100) - (rhs.priority || 100));

    return (
      <div
        className='dashlet dashlet-todo'
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <h4>{t('Tasks / Suggestions')}</h4>
        <div style={{ overflowY: 'auto' }}>
          <ListGroup style={{ marginBottom: 0 }}>
            {
              visibleSteps.map(step => {
                const props = step.props ? step.props(extensionProps[step.id]) : this.props;

                return (
                  <ListGroupItem key={step.id} className={`todo-${step.type}`}>
                    <Icon
                      className={`icon-todo-type icon-todo-${step.type}`}
                      name={this.typeToIcon(step.type)}
                    />
                    {step.render(t, props)}
                    {this.renderButton(step.button)}
                    <IconButton
                      id={`btn-dismiss-${step.id}`}
                      icon='remove'
                      tooltip={t('Dismiss')}
                      className='btn-embed'
                      value={step.id}
                      onClick={this.dismiss}
                    />
                  </ListGroupItem>
                );
              })
            }
          </ListGroup>
        </div>
      </div>
    );
  }

  private renderButton(buttonGen: () => IToDoButton): JSX.Element {
    if (buttonGen === undefined) {
      return null;
    }
    const button = buttonGen();
    if (button === undefined) {
      return null;
    }
    return (
      <IconButton
        id={button.text}
        icon={button.icon}
        onClick={button.onClick}
        tooltip={button.text}
      >
        {button.text}
      </IconButton>
    );
  }

  private typeToIcon(type: ToDoType): string {
    return {
      'settings-review': 'sliders',
      settings: 'sliders',
      automation: 'wand',
      search: 'zoom',
    }[type];
  }

  private openGameSettings = () => {
    this.context.api.events.emit('show-main-page', 'Settings');
    this.props.onSetSettingsPage('Games');
  }

  private openModsSettings = () => {
    this.context.api.events.emit('show-main-page', 'Settings');
    this.props.onSetSettingsPage('Mods');
  }

  private openInterfaceSettings = () => {
    this.context.api.events.emit('show-main-page', 'Settings');
    this.props.onSetSettingsPage('Interface');
  }

  private openVortexSettings = () => {
    this.context.api.events.emit('show-main-page', 'Settings');
    this.props.onSetSettingsPage('Vortex');
  }

  private startManualSearch = () => {
    this.context.api.events.emit('start-discovery');
  }

  private openGames = () => {
    this.context.api.events.emit('show-main-page', 'Games');
  }

  private dismiss = (evt: React.MouseEvent<any>) => {
    const stepId = evt.currentTarget.value;
    this.props.onDismissStep(stepId);
  }
}

function mapStateToProps(state: any, ownProps: IBaseProps): IConnectedState {
  const extensionProps: any = {};
  ownProps.todos.forEach(todo => {
    extensionProps[todo.id] = todo.props !== undefined ? todo.props(state) : {};
  });

  return {
    dismissAll: state.settings.firststeps.dismissAll,
    steps: state.settings.firststeps.steps,
    extensionProps,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onDismissStep: (step: string) => dispatch(dismissStep(step)),
    onSetSettingsPage: (pageId: string) => dispatch(setSettingsPage(pageId)),
  };
}

export default translate(['common'], { wait: true })(
  connect(mapStateToProps, mapDispatchToProps)(
    Dashlet)) as React.ComponentClass<IBaseProps>;
