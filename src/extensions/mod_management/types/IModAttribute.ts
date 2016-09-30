import { IMod } from './IMod';

/**
 * declaration of an attribute of a mod
 * 
 * @export
 * @interface IModAttribute
 */
export interface IModAttribute {
  id: string;
  name: string;
  description?: string;
  icon: string;
  isDetail: boolean;
  isToggleable: boolean;
  sortFunc?: (lhs: any, rhs: any, locale: string) => number;
  filterFunc?: (filter: string, value: any) => boolean;
}
