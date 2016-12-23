export type AttributeRenderer = 'progress';

/**
 * declaration of an attribute of a table
 * 
 * @export
 * @interface IModAttribute
 */
export interface ITableAttribute {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isToggleable: boolean;
  isReadOnly: boolean;
  isSortable: boolean;
  isDetail: boolean;
  customRenderer?: (attributes: any, t: I18next.TranslationFunction) => JSX.Element;
  calc?: (attributes: any, t: I18next.TranslationFunction) => any;
  sortFunc?: (lhs: any, rhs: any, locale: string) => number;
  filterFunc?: (filter: string, value: any) => boolean;
}
