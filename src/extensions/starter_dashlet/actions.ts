import safeCreateAction from '../../actions/safeCreateAction';

export const setPrimaryTool = safeCreateAction('SET_PRIMARY_TOOL',
  (gameId: string, toolId: string) => ({ gameId, toolId }));

export const setAddToTitleBar = safeCreateAction('SET_ADD_TO_TITLEBAR',
  (gameId: string, addToTitleBar: boolean) => ({ gameId, addToTitleBar }));

export const setToolOrder = safeCreateAction('SET_TOOLS_ORDER',
(gameId: string, tools: string[]) => ({ gameId, tools }));
