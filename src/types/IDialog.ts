export type DialogType =
  'success' | 'info' | 'error' | 'question';

export type DialogActions = { [label: string]: Function };

export interface IDialog {
  id: string;
  type: DialogType;
  title: string;
  content: IDialogContent;
  actions: string[];
}

export interface ICheckbox {
  id: string;
  text: string;
  value: boolean;
}

export interface IDialogContent {
  htmlFile?: string;
  message?: string;
  checkboxes?: ICheckbox[];
}

export interface IDialogResult {
  action: string;
  input: any;
}
