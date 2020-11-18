import createAction from '../../../actions/safeCreateAction';

// Can be used to store game specific load order options
//  for the specified gameId.
export const setGameLoadOrderDisplayCheckboxes =
  createAction('SET_LOAD_ORDER_DISPLAY_CHECKBOXES',
    (gameId: string, displayCheckboxes: boolean) =>
      ({ gameId, displayCheckboxes })) as any;
