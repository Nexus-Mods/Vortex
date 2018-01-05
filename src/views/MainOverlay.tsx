import IconBar from '../controls/IconBar';
import { IActionDefinition } from '../types/IActionDefinition';
import { ComponentEx } from '../util/ComponentEx';

import * as React from 'react';

export interface IBaseProps {
  open: boolean;
  overlayRef: (ref: HTMLElement) => void;
}

type IProps = IBaseProps;

class MainOverlay extends ComponentEx<IProps, {}> {
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
    const { open, overlayRef } = this.props;
    const classes = [ 'overlay' ];
    if (open) {
      classes.push('in');
    }
    return (
      <div className={classes.join(' ')}>
        <div ref={overlayRef} />
        <div className='flex-fill' />
        <div className='global-overlay'>
          <IconBar
            group='help-icons'
            staticElements={this.buttons}
            orientation='vertical'
          />
        </div>
      </div>
    );
  }
}

export default MainOverlay as React.ComponentClass<IBaseProps>;
