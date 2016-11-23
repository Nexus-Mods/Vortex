import {ILookupResult, IReference} from 'modmeta-db';

export interface IDependency {
  download: string;
  reference: IReference;
  lookupResults: ILookupResult[];
}
