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

export interface IFormControl {
  id: string;
  type: string;
  value: string;
}

export interface IDialogContent {
  htmlFile?: string;
  message?: string;
  checkboxes?: ICheckbox[];
  formcontrol?: IFormControl;
}

export interface IDialogResult {
  action: string;
  input: any;
}
