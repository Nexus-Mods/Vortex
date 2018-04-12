import { IExtensionContext, ToDoType } from '../../types/IExtensionContext';
import {showError} from '../../util/message';

import Dashlet from './Dashlet';
import { IToDo } from './IToDo';
import settingsReducer from './reducers';
import todos from './todos';

import * as I18next from 'i18next';

const extTodos: IToDo[] = [];

function init(context: IExtensionContext): boolean {
  context.registerToDo = (id: string,
                          type: ToDoType,
                          props: (state: any) => any,
                          icon: (props: any) => JSX.Element,
                          text: (t: I18next.TranslationFunction, props: any) => JSX.Element,
                          action?: (props: any) => void,
                          condition?: (props: any) => boolean,
                          value?: (t: I18next.TranslationFunction, props: any) => JSX.Element,
                          priority?: number) => {
    extTodos.push({ id, icon, type, props, condition, text, value, action, priority });
  };

  context.registerDashlet('To Do List', 2, 2, 150, Dashlet, state => {
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
  }), undefined);

  context.registerReducer(['settings', 'firststeps'], settingsReducer);

  return true;
}

export default init;
