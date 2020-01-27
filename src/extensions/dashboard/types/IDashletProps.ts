import {PropsCallback} from '../../../types/IExtensionContext';

export interface IDashletProps {
  title: string;
  width: 1 | 2 | 3;
  height: 1 | 2 | 3 | 4 | 5;
  position: number;
  component: React.ComponentClass<any>;
  props?: PropsCallback;
  isVisible?: (state: any) => boolean;
  fixed: boolean;
  closable: boolean;
}
