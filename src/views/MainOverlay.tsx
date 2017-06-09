import { IActionDefinition } from '../types/IActionDefinition';
import { ComponentEx } from '../util/ComponentEx';

import IconBar from './IconBar';

import * as React from 'react';

export interface IBaseProps {
  pageOverlay: JSX.Element;
  open: boolean;
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
          icon: 'wrench',
          title: 'Developer',
          action: () => this.context.api.events.emit('show-modal', 'developer'),
        },
      );
    }
  }

  public render(): JSX.Element {
    const { open, pageOverlay } = this.props;
    const classes = [ 'overlay' ];
    if (open) {
      classes.push('in');
    }
    return (
      <div className={classes.join(' ')}>
        {pageOverlay}
        <div className='flex-fill' />
        <div className='global-overlay'>
          <IconBar
            group='help-icons'
            staticElements={this.buttons}
            buttonType='both'
            orientation='vertical'
          />
        </div>
      </div>
    );
  }
}

export default MainOverlay as React.ComponentClass<IBaseProps>;
