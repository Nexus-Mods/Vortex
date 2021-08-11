import { Action } from 'redux';
import { generate as shortid } from 'shortid';
import { showDialog } from '../../actions';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { ProcessCanceled, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import local from '../../util/local';
import { batchDispatch } from '../../util/util';

import { addHistoryEvent, markHistoryReverted, setHistoryEvent, showHistory } from './actions';
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
  let actions: Action[] = [];

  const debouncer = new Debouncer(() => {
    batchDispatch(api.store, actions);
    actions = [];
    return Promise.resolve();
  }, 100, false, false);

  return (stack: string, entry: IHistoryEvent) => {
    actions.push(addHistoryEvent(stack, {
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
  context.registerReducer(['persistent', 'history'], persistentReducer);
  context.registerReducer(['session', 'history'], sessionReducer);

  context.registerHistoryStack = registerHistoryStack;
  context.registerAPI('addToHistory', makeAddToHistory(context.api), {});
  context.registerAPI('showHistory', (stackId: string) => {
    context.api.store.dispatch(showHistory(stackId));
  }, {});
  context.registerDialog('history-dialog', HistoryDialog, () => {
    return {
      onClose: () => {
        context.api.store.dispatch(showHistory(undefined));
      },
      onReverted: (stackId: string, evt: IHistoryEvent) => {
        context.api.store.dispatch(markHistoryReverted(stackId, evt));
      },
      onError: (err: Error, stackId: string, evt: IHistoryEvent) => {
        const allowReport = !(err instanceof ProcessCanceled || err instanceof UserCanceled);
        context.api.showErrorNotification('Failed to revert event', err, { allowReport });
        if (evt.reverted) {
          context.api.store.dispatch(setHistoryEvent(stackId, { ...evt, reverted: false }));
        }
        context.api.store.dispatch(showHistory(undefined));
      },
      stacks,
    };
  });

  return true;
}

export default init;
