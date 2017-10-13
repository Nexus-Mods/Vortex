import {IChanges} from './IChanges';

import * as Promise from 'bluebird';

export interface IIniFormat {
  read(filePath: string): Promise<any>;
  write(filePath: string, data: any, changes: IChanges): Promise<void>;
}
