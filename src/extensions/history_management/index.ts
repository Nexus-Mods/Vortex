import { generate as shortid } from 'shortid';
import { showDialog } from '../../actions';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import local from '../../util/local';

import { addHistoryEvent, markHistoryReverted, showHistory } from './actions';
import HistoryDialog from './HistoryDialog';
import { persistentReducer, sessionReducer } from './reducers';
import { IHistoryEvent, IHistoryStack } from './types';

interface IHistoryStacks {
  [id: string]: IHistoryStack;
}

const stacks: IHistoryStacks = local<IHistoryStacks>('history-stacks', {});

function registerHistoryStack(id: string, options: IHistoryStack) {
  stacks[id] = options;
}

function makeAddToHistory(api: IExtensionApi) {
  return (stack: string, entry: IHistoryEvent) => {
    api.store.dispatch(addHistoryEvent(stack, {
      ...entry,
      reverted: false,
      id: shortid(),
      timestamp: Date.now(),
    },
      stacks[stack].size,
    ));
  };
}

function init(context: IExtensionContext): boolean {
  context.registerHistoryStack = registerHistoryStack;
  context.registerAPI('addToHistory', makeAddToHistory(context.api), {});
  context.registerAPI('showHistory', (stackId: string) => {
    context.api.store.dispatch(showHistory(stackId));
  }, {});
  context.registerReducer(['persistent', 'history'], persistentReducer);
  context.registerReducer(['session', 'history'], sessionReducer);

  context.registerDialog('history-dialog', HistoryDialog, () => {
    const state = context.api.getState();
    return {
      onClose: () => {
        context.api.store.dispatch(showHistory(undefined));
      },
      onReverted: (stackId: string, evt: IHistoryEvent) => {
        context.api.store.dispatch(markHistoryReverted(stackId, evt));
      },
      stacks,
    };
  });

  return true;
}

export default init;
