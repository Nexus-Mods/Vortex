import safeCreateAction from '../../actions/safeCreateAction';

export const setPrimaryTool = safeCreateAction('SET_PRIMARY_TOOL',
  (gameId: string, toolId: string) => ({ gameId, toolId }));

export const setToolOrder = safeCreateAction('SET_TOOLS_ORDER',
  (gameId: string, tools: string[]) => ({ gameId, tools }));

export const setToolValid = safeCreateAction('SET_TOOL_IS_VALID',
  (gameId: string, toolId: string, valid: boolean) => ({ gameId, toolId, valid }));
