import { IToDoButton, ToDoType } from '../../types/IExtensionContext';

import { TranslationFunction } from 'i18next';

export interface IToDo {
  id: string;
  type: ToDoType;
  props?: (state: any) => any;
  condition: (props: any) => boolean;
  render?: (t: TranslationFunction, props: any) => JSX.Element;
  button?: () => IToDoButton;
  priority?: number;
}
