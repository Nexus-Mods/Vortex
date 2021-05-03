import * as types from '../api';

export interface IGameSpecificParserProps {
  api: types.IExtensionApi;
  gameId: string;
  collection: any;
}
