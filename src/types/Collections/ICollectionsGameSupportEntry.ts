import { IGameSpecificGeneratorProps } from './IGameSpecificGeneratorProps';
import { IGameSpecificInterfaceProps } from './IGameSpecificInterfaceProps';
import { IGameSpecificParserProps } from './IGameSpecificParserProps';

export interface ICollectionsGameSupportEntry {
  gameId: string;
  generator: (props: IGameSpecificGeneratorProps) => Promise<any>;
  parser: (props: IGameSpecificParserProps) => Promise<void>;
  interface: (props: IGameSpecificInterfaceProps) => JSX.Element;
}
