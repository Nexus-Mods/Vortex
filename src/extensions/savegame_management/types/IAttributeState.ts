import { SortDirection } from '../../../types/SortDirection';

/**
 * user-configuration for savegame attributes
 * 
 * @export
 * @interface IAttributeState
 */
export interface IAttributeState {
  enabled: boolean;
  sortDirection: SortDirection;
}
