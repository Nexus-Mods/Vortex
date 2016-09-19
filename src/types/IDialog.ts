export type IDialogType =
  'success' | 'info' | 'error';

export interface IDialog {
  type: IDialogType;
  title: string;
  message: string;
}
