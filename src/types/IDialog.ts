export type DialogType =
  'success' | 'info' | 'error';

export type DialogActions = { [label: string]: Function };

export interface IDialog {
  id: string;
  type: DialogType;
  title: string;
  content: IDialogContent;
  actions: string[];
}

export interface IDialogContent {
  htmlFile?: string;
  message?: string;
}
