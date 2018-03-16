export type DialogType =
  'success' | 'info' | 'error' | 'question';

export interface IDialogAction {
  label: string;
  default?: boolean;
  action?: (label: string) => void;
}

export type DialogActions = IDialogAction[];

export interface IDialog {
  id: string;
  type: DialogType;
  title: string;
  content: IDialogContent;
  defaultAction: string;
  actions: string[];
}

export interface ICheckbox {
  id: string;
  text: string;
  value: boolean;
}

export interface IInput {
  id: string;
  type?: 'text' | 'password' | 'number' | 'date' | 'time' | 'email' | 'url';
  value?: string;
  label?: string;
  placeholder?: string;
}

export interface ILink {
  label: string;
  id?: string;
  action?: (dismiss: () => void, id: string) => void;
}

export interface IDialogContent {
  htmlFile?: string;
  /**
   * displays a message as html.
   * NOTE: this will be inserted directy
   * into the dom so it must never be html from
   * an external source!
   *
   * @type {string}
   * @memberOf IDialogContent
   */
  htmlText?: string;
  /**
   * regular text. This will be wrapped, not selectable for the user,
   * not scrollable and not maintain any kind of predefined linebreaks.
   */
  text?: string;
  /**
   * regular text. This will be put into a scrollable, selectable textbox.
   * Whether the text wraps or not is determined by options.wrap
   */
  message?: string;
  bbcode?: string;
  checkboxes?: ICheckbox[];
  choices?: ICheckbox[];
  input?: IInput[];
  /**
   * list of clickable entries that don't (necessarily) cause the dialog to close
   */
  links?: ILink[];
  parameters?: any;
  options?: {
    translated?: boolean;
    wrap?: boolean;
  };
}

export interface IDialogResult {
  action: string;
  input: any;
}
