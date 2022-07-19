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
    debouncer.schedule();
  };
}

function onErrorImpl(api: IExtensionApi, err: Error, evt: IHistoryEvent, stackId: string) {
  const allowReport = !(err instanceof ProcessCanceled || err instanceof UserCanceled);
  api.showErrorNotification('Failed to revert event', err, { allowReport });
  if (evt.reverted) {
    api.store.dispatch(setHistoryEvent(stackId, { ...evt, reverted: false }));
  }
  api.store.dispatch(showHistory(undefined));
}

function init(context: IExtensionContext): boolean {
  context.registerReducer(['persistent', 'history'], persistentReducer);
  context.registerReducer(['session', 'history'], sessionReducer);

  context.registerHistoryStack = registerHistoryStack;
  context.registerAPI('addToHistory', makeAddToHistory(context.api), {});
  context.registerAPI('showHistory', (stackId: string) => {
    context.api.store.dispatch(showHistory(stackId));
  }, {});

  const onClose = () => context.api.store.dispatch(showHistory(undefined));

  const onReverted = (stackId: string, evt: IHistoryEvent) =>
    context.api.store.dispatch(markHistoryReverted(stackId, evt));

  const onError = (err: Error, stackId: string, evt: IHistoryEvent) =>
    onErrorImpl(context.api, err, evt, stackId);

  context.registerDialog('history-dialog', HistoryDialog, () => {
    return {
      onClose,
      onReverted,
      onError,
      stacks,
    };
  });

  return true;
}

export default init;
