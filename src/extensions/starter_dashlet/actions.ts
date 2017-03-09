import safeCreateAction from '../../actions/safeCreateAction';

export const setPrimaryTool = safeCreateAction('SET_PRIMARY_TOOL',
  (gameId: string, toolId: string) => ({ gameId, toolId }));
