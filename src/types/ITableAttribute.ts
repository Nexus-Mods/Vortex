import { ITString, TFunction } from '../util/i18n';

export type AttributeRenderer = 'progress';

export type Placement = 'table' | 'detail' | 'both' | 'inline';

export type ValidationState = 'success' | 'warning' | 'error';

export interface IEditChoice {
  key: string;
  text: string;
  icon?: string;
  /**
   * select if this choice is visible (default) to the user.
   * invisible choices can only be set programmatically
   */
  visible?: boolean;
}

export interface IFilterProps {
  filter: any;
  attributeId: string;
  t: TFunction;
  onSetFilter: (attributeId: string, value: any) => void;
  domRef: (ref: HTMLElement) => void;
}

export interface ITableFilter {
  /**
   * return true if value matches the filter
   * @param filter the filter pattern to filter by
   * @param value the row value for the specified column
   * @param state application state, usually an IState object but may contain additional fields
   *              from extensions
   * @note the raw parameter controls what value actually gets passed into matches. If raw is false,
   *       value will be the output of the calc function of the ITableAttribute.
   *       If raw is true, value will be the raw value of the table item where the name matches
   *       the table attribute. So if the table attribute has id "name" then value would be
   *       tableitem["name"]. If raw is a string, that is used instead of the table attribute id.
   *       If ITableAttribute.calc doesn't simply transform an attribute of the item but consults
   *       a separate data source, you have to set raw to false, there is no way to get correct
   *       results otherwise.
   *       If calc returns localized strings for example you will want to use raw, generally it
   *       is often simpler to deal with raw values (true instead of "Enabled")
   */
  matches: (filter: any, value: any, state: any) => boolean;
  /**
   * return true if the specified filter will not filter out any elements
   * if not specified the filter will be assumed to be "empty" if it's not truthy
   */
  isEmpty?: (filter: any) => boolean;
  /**
   * this controls what value gets passed into the matches function, see the documentation there
   * for possible values
   */
  raw: string | boolean;
  component: React.ComponentType<IFilterProps>;
  dataId?: string;
}

export interface ICustomProps {
  onHighlight: (highlight: boolean) => void;
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
  name?: string | ITString;
  /**
   * lengthier description of what the attribute represents
   * (currently unused but please provide one anyway)
   */
  description?: string | ITString;
  /**
   * position of the attribute within the table (at some point we may allow users to override
   * this at which point this will be the default)
   */
  position?: number;
  /**
   * optional help text regarding this field. This will only show up in the details pane, if there
   * is no custom renderer and only if a name is set (as otherwise the space for the help icon
   * doesn't exist)
   */
  help?: string | ITString;
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
   * if true (or a function), the table can be grouped by this attribute.
   * if this is a function it will be called with the object to determine the value to use for
   * grouping, otherwise the output of calc is used. This function must be fast, unlike calc
   * the result from this is not cached (at this time)
   */
  isGroupable?: boolean | ((object: T, t: TFunction) => string);
  /**
   * if set, the table can be filtered by this attribute using the specified control
   */
  filter?: ITableFilter;
  /**
   * if set, this attribute will be the one that gets focused when pressing ctrl+f
   * There can only be one of these and it should be a column that is visible by default.
   * And of course it has to be filterable
   * If more than one attribute has this flag the first one will be used.
   */
  isDefaultFilter?: boolean;
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
   * TODO: Obsolete
   * if true, the calc-function for this attribute is called whenever table data is refreshed,
   * even if the corresponding row data didn't change.
   * Otherwise (default) the values for this attribute are only updated when the input data to the
   * row changes. This means you need this flag, if the value of the attribute may change without
   * the row data changing.
   * This is the case for example when your extension generates data in a separate object and then
   * only uses the row id to look up data from that object.
   * If you fail to set this flag when the rendered data isn't part of the table data
   * your attribute won't show up at all
   * You should make extra sure the calc-function is quick though. If it takes computation, you
   * may want to use a custom renderer with some manner of caching and debouncing.
   */
  isVolatile?: boolean;
  /**
   * Never shrink the column while scrolling, it can still grow though
   */
  noShrink?: boolean;
  /**
   * when using external data (not part of the data passed to the table) in calc or customRenderer,
   * set this parameter.
   * This function gets called with a callback that then needs to be called whenever the external
   * data (any of it) changes to cause a rerender.
   */
  externalData?: (onChanged: () => void) => void;
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
   * Also note that table cells using customRenderer will do more unnecessary rerenders than a
   * calc-based field so please use customRenderer only when necessary.
   */
  customRenderer?: (object: T | T[], detailCell: boolean,
                    t: TFunction, props: ICustomProps) => JSX.Element;
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
  calc?: (object: T, t: TFunction) => any | Promise<any>;
  /**
   * custom function for sorting by this attribute. The parameters passed in (lhs and rhs) are
   * the output of calc (cached). Return <0 if lhs is smaller than rhs, >0 if it's bigger and
   * =0 if they are equal.
   */
  sortFunc?: (lhs: any, rhs: any, locale: string) => number;
  /**
   * custom function for sorting by this attribute. The parameters passed in (lhs and rhs) are
   * the objects to compare. Return <0 if lhs is smaller than rhs, >0 if it's bigger and
   * =0 if they are equal.
   */
  sortFuncRaw?: (lhs: T, rhs: T, locale: string) => number;
  /**
   * if specified, this is called to determine if the attribute is visible at all.
   * This can be used to hide attributes on game where they aren't supported.
   * This will only be evaluated when the table is created, when the user switches column visibility
   * manually or when the list of table columns programmatically changes but you can not use it
   * to dynamically hide columns _without_ changing any table props.
   */
  condition?: () => boolean;
  /**
   * does this attribute support displaying and editing multiple values? defaults to false.
   * If this is false the attribute is not displayed with multiple items selected. If this is true,
   * customRenderer receives an array of objects to display and onChangeValue receive an array of
   * rows to set the new value on
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
     * if set, this function determines if the attribute is editable. If "edit" is an empty
     * object, the attribute is readonly. If "edit" is non-empty and "readonly" is
     * undefined, the attribute is editable.
     */
    readOnly?: (object: any) => boolean;

    /**
     * allow inline editing of this cell
     */
    inline?: boolean,

    /**
     * Affects how choices are displayed if you have a choice attribute
     * if true (or undefined) then we display a drop-down box where each item immediately triggers
     * an action. If false, render a selection box
     */
    actions?: boolean,

    /**
     * if set, this is called to determine the placeholder to be displayed when the input box is
     * empty. Has no effect if this edit config doesn't generate an input box
     */
    placeholder?: () => string,

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
    onChangeValue?: (objects: T | T[], newValue: any) => void,
  };
}
