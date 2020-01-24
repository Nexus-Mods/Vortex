import IconBar from '../controls/IconBar';
import { IActionDefinition } from '../types/IActionDefinition';
import { ComponentEx } from '../util/ComponentEx';

import { TFunction } from 'i18next';
import * as React from 'react';

export interface IBaseProps {
  t: TFunction;
}

type IProps = IBaseProps;

class GlobalOverlay extends ComponentEx<IProps, {}> {
  private buttons: IActionDefinition[];
  constructor(props: IProps) {
    super(props);

    this.buttons = [];
    if (process.env.NODE_ENV === 'development') {
      this.buttons.push(
        {
          icon: 'mods',
          title: 'Developer',
          action: () => this.context.api.events.emit('show-modal', 'developer'),
        },
      );
    }
  }

  public render(): JSX.Element {
    return (
      <div className='global-overlay'>
        <IconBar
          group='help-icons'
          staticElements={this.buttons}
          orientation='vertical'
        />
      </div>);
  }
}

export default GlobalOverlay;
