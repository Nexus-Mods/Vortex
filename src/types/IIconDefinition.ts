import * as React from 'react';

export interface IIconDefinition {
  icon?: string;
  title?: string;
  action?: () => void;
  component?: React.ComponentClass<any>;
  props?: () => Object;
}
