import { ToDoType } from '../../types/IExtensionContext';

import { TFunction } from 'i18next';

export interface IToDo {
  id: string;
  type: ToDoType;
  props?: (state: any) => any;
  icon: ((props: any) => JSX.Element) | string;
  text: ((t: TFunction, props: any) => JSX.Element | string) | string;
  value?: ((t: TFunction, props: any) => JSX.Element | string) | string;
  condition?: (props: any) => boolean;
  action?: (props: any) => void;
  priority?: number;
}
