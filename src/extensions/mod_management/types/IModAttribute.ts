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
  sortFunc?: (lhs: any, rhs: any) => number;
  filterFunc?: (filter: string, value: any) => boolean;
}
