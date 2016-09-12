import { II18NProps } from '../types/II18NProps';
import { Button } from './TooltipControls';

import * as React from 'react';
import { ButtonGroup } from 'react-bootstrap';
import { translate } from 'react-i18next';

import Icon = require('react-fontawesome');

interface IIconBarProps {
  onShowLayer: Function;
}

interface IIconBarState {
}

class IconBar extends React.Component<IIconBarProps & II18NProps, IIconBarState> {
  public render(): JSX.Element {

    const { t, onShowLayer } = this.props;

    return (
      <div>
        <ButtonGroup>
          <Button tooltip='Placeholder' id='placeholder' placement='bottom'>
            <Icon name='bank' />
          </Button>
        </ButtonGroup>
        <ButtonGroup className='pull-right'>
          <Button tooltip={t('Settings')} id='settings' placement='bottom' onClick={() => onShowLayer('settings') }>
            <Icon name='gear' />
          </Button>
        </ButtonGroup>
      </div>
    );
  }
}

export default translate(['common'], { wait: true })(IconBar);
