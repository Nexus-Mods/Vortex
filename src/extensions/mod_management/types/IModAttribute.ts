import {ITableAttribute} from '../../../types/ITableAttribute';

/**
 * declaration of an attribute of a mod
 * 
 * @export
 * @interface IModAttribute
 */
export interface IModAttribute extends ITableAttribute {
  isDetail: boolean;
}
