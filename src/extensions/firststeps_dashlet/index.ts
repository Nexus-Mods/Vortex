import { IExtensionContext, ToDoType } from '../../types/IExtensionContext';
import {showError} from '../../util/message';

import Dashlet from './Dashlet';
import { IToDo } from './IToDo';
import settingsReducer from './reducers';
import todos from './todos';

const extTodos: IToDo[] = [];

function init(context: IExtensionContext): boolean {
  context.registerToDo = (id: string,
                          type: ToDoType,
                          props: () => any,
                          condition: (props: any) => boolean,
                          render: (props: any) => JSX.Element,
                          button?: () => {
                            text: string,
                            icon: string,
                            onClick: () => void,
                          },
                          priority?: number) => {
    extTodos.push({ id, type, props, condition, render, button, priority });
  };

  context.registerDashlet('ToDo', 2, 2, 200, Dashlet, state => {
    const allTodos: IToDo[] = [].concat(todos(context.api), extTodos);
    const steps = state.settings.firststeps.steps;

    const visibleSteps = allTodos.filter(item => {
        if (steps[item.id]) {
          return false;
        }

        if (item.condition) {
          const props = item.props ? item.props(state) : {};
          return item.condition(props);
        } else {
          return true;
        }
      });
    return visibleSteps.length > 0;
  }, () => ({
    todos: [].concat(todos(context.api), extTodos),
  }));

  context.registerReducer(['settings', 'firststeps'], settingsReducer);

  return true;
}

export default init;
