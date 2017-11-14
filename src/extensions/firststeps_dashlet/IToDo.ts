import { IToDoButton, ToDoType } from '../../types/IExtensionContext';

import { TranslationFunction } from 'i18next';

export interface IToDo {
  id: string;
  type: ToDoType;
  props?: (state: any) => any;
  icon: ((props: any) => JSX.Element) | string;
  text: ((t: TranslationFunction, props: any) => JSX.Element) | string;
  value?: ((t: TranslationFunction, props: any) => JSX.Element) | string;
  condition?: (props: any) => boolean;
  action?: (props: any) => void;
  priority?: number;
}
