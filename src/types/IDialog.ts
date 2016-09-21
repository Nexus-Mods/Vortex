export type DialogType =
  'success' | 'info' | 'error';

export interface IDialog {
  type: DialogType;
  title: string;
  message: string;
}
