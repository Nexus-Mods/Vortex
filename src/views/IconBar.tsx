import { Button } from './TooltipControls';

import * as React from 'react';
import { ButtonGroup } from 'react-bootstrap';

import Icon = require('react-fontawesome');

interface IIconBarProps {
  onShowLayer: Function;
}

interface IIconBarState {
}

export class IconBar extends React.Component<IIconBarProps, IIconBarState> {
  public render() {

    let { onShowLayer } = this.props;

    return (
      <div>
        <ButtonGroup>
          <Button tooltip='Placeholder' id='placeholder' placement='bottom'>
            <Icon name='bank' />
          </Button>
        </ButtonGroup>
        <ButtonGroup className='pull-right'>
          <Button tooltip='Settings' id='settings' placement='bottom' onClick={() => { onShowLayer('settings'); } }>
            <Icon name='gear' />
          </Button>
        </ButtonGroup>
      </div>
    );
  }
}
