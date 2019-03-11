import { ToDoType } from '../../types/IExtensionContext';

import I18next from 'i18next';

export interface IToDo {
  id: string;
  type: ToDoType;
  props?: (state: any) => any;
  icon: ((props: any) => JSX.Element) | string;
  text: ((t: I18next.TFunction, props: any) => JSX.Element | string) | string;
  value?: ((t: I18next.TFunction, props: any) => JSX.Element | string) | string;
  condition?: (props: any) => boolean;
  action?: (props: any) => void;
  priority?: number;
}
