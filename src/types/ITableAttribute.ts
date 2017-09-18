import * as I18next from 'i18next';

export type AttributeRenderer = 'progress';

export type Placement = 'table' | 'detail' | 'both';

export type ValidationState = 'success' | 'warning' | 'error';

export interface IEditChoice {
  key: string;
  text: string;
  /**
   * select if this choice is visible (default) to the user.
   * invisible choices can only be set programmatically
   */
  visible?: boolean;
}

export interface IFilterProps {
  filter: any;
  attributeId: string;
  t: I18next.TranslationFunction;
  onSetFilter: (attributeId: string, value: any) => void;
}

export interface ITableFilter {
  matches: (filter: any, value: any, state: any) => boolean;
  raw: boolean;
  component: React.ComponentClass<IFilterProps>;
}

/**
 * declaration of an attribute of a table
 *
 * @export
 * @interface IModAttribute
 */
export interface ITableAttribute<T = any> {
  /**
   * internal id of the attribute
   */
  id: string;
  /**
   * user readable name for the attribute (appears in the header and potentially in tooltips)
   */
  name?: string;
  /**
   * lengthier description of what the attribute represents
   * (currently unused but please provide one anyway)
   */
  description?: string;
  /**
   * optional help text regarding this field. This will only show up in the details pane, if there
   * is no custom renderer and only if a name is set (as otherwise the space for the help icon
   * doesn't exist)
   */
  help?: string;
  /**
   * icon for the attribute. This is currently only used for the toggle button if the column is
   * toggleable
   */
  icon?: string;
  /**
   * if true the attribute can be disabled in the table
   */
  isToggleable?: boolean;
  /**
   * if true, the table can be sorted by this attribute
   */
  isSortable?: boolean;
  /**
   * if set, the table can be filtered by this attribute using the specified control
   */
  filter?: ITableFilter;
  /**
   * if true (default), the column is visible by default otherwise the user has to activate it
   * manually first
   */
  isDefaultVisible?: boolean;
  /**
   * if this is true and if the user hasn't changed column sorting yet, this column will be used
   * for sorting (ascending) as long as it's visible and no previous column had this flag set.
   */
  isDefaultSort?: boolean;
  /**
   * if true, the calc-function for this attribute is called from time to time to see if it changed.
   * Otherwise (default) the values for this attribute are only updated when the input data to the
   * table changes. This means you need this flag, if the value of the attribute may change without
   * the table data changing.
   * This is the case for example when your extension generates data in a separete object and then
   * only uses the row id to look up data from that object.
   * You should make extra sure the calc-function is quick.
   */
  isVolatile?: boolean;
  /**
   * specifies whether the attribute appears in the table, the details pane or both.
   * \note that "isToggleable" and "isSortable" have no effect on attributes that don't appear
   * in the table
   */
  placement: Placement;
  /**
   * if specified this function is used to render the value in the table instead of the usual cell
   * renderer. Please note that if you want caching or asynchronous calculation for this cell you'll
   * have to implement it yourself.
   */
  customRenderer?: (object: T | T[], detailCell: boolean,
                    t: I18next.TranslationFunction) => JSX.Element;
  /**
   * determine the display value for this attribute. This is used for display if customRenderer is
   * not specified. It's also used for sorting the table so unless isSortable is false and a
   * customRenderer is used you have to provide a calc function.
   * Please return "appropriate" types, that is: standard types like string, boolean, number, Date
   * and from those the one that most closely models what the data contains (i.e. if the attribute
   * is a date return a Date object so that the Table can properly render and sort it according
   * to the locale)
   * \note: calc may return a Promise, the table will then update once the value is calculated
   * \note: The table will only automatically refresh and call "calc" if one of its props changes.
   *        This means that if you bind a variable to your calc function which is not part of
   *        the Table props the Table may appear glitchy as it won't update as necessary.
   */
  calc?: (object: T, t: I18next.TranslationFunction) => any | Promise<any>;
  /**
   * custom function for sorting by this attribute. The parameters passed in (lhs and rhs) are
   * by calc (cached). Return <0 if lhs is smaller than rhs, >0 if it's bigger and =0 if they are
   * equal.
   */
  sortFunc?: (lhs: any, rhs: any, locale: string) => number;
  /**
   * does this attribute support displaying and editing multiple values? defaults to false.
   * If this is false the attribute is not displayed with multiple items selected. If this is true,
   * customRenderer receives an array of objects to display and onChangeValue receive an array of
   * rowIds to set the new value on
   *
   * @type {boolean}
   * @memberof ITableAttribute
   */
  supportsMultiple?: boolean;
  /**
   * describes how editing for this field should work. Only one out of "choices", "validate"
   * should be used
   *
   * Please note that this only works if no customRenderer is set. Otherwise that renderer
   * will have to implement its own editing functionality
   */
  edit: {
    /**
     * if set, this function determins if the attribute is editable. If "edit" is an empty
     * object, the attribute is readonly. If "edit" is non-empty and "readonly" is
     * undefined, the attribute is editable.
     */
    readOnly?: (object: any) => boolean;

    /**
     * allow inline editing of this cell
     */
    inline?: boolean,

    /**
     * if set, this field is a drop-down selection with the choices returned by this function.
     * Please note: the value returned by calc has to appear in the text-field of one of these
     *   choices
     */
    choices?: () => IEditChoice[],

    /**
     * if set, this field is a text field that validates its input
     */
    validate?: (input: string) => ValidationState,

    /**
     * called when this attribute was changed for an object. The way editing is presented to the
     * user (if you didn't specify a customRenderer) depends on the value type.
     * Potentially "newValue" can be undefined which signals a "toggle" or "cycle to the next
     * value"
     *
     * If this attribute is undefined, the field is readonly
     */
    onChangeValue?: (rowId: string | string[], newValue: any) => void,
  };
}
