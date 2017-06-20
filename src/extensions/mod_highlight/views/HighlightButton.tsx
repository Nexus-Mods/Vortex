import { IState } from '../../../types/IState';
import { ComponentEx, connect } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import { IconButton } from '../../../views/TooltipControls';

import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';

import { Button, ControlLabel, FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';

const cssHighlightList: string[] = [
  'highlight-1',
  'highlight-2',
  'highlight-3',
  'highlight-4',
  'highlight-5',
  'highlight-default',
];

export interface IBaseProps {
  mod: IMod;
  gameMode: string;
  t: I18next.TranslationFunction;
}

interface IActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * Highlight Button
 *
 * @class HighlightButton
 */
class HighlightButton extends ComponentEx<IProps, {}> {

  public render(): JSX.Element {
    const { mod, t } = this.props;

    if (mod.state !== 'installed') {
      return null;
    }

    const color = getSafe(mod.attributes, ['color'], '');
    const icon = getSafe(mod.attributes, ['icon'], '');

    const modIcon: string[] = ['bomb', 'map', 'shield', 'flask',
      'flag', 'hotel', 'flash', 'home', 'eye'];

    const popoverBottom = (
      <Popover
        id='popover-highlight-settings'
        title={t('Highlight Settings')}
      >
        <FormGroup key={mod.id}>
          <ControlLabel>{t('Select theme')}
          </ControlLabel>
          <div key='dialog-form-colors'>
            {cssHighlightList.map((highlightColor) => {
              return this.renderHighlightColor(highlightColor);
            })}
          </div>
          <ControlLabel>{t('Select mod icon')}
          </ControlLabel>
          <div>
            {modIcon.map(this.renderIcons)}
          </div>
        </FormGroup>
      </Popover>
    );

    return (
      <div style={{ textAlign: 'center' }}>
        <OverlayTrigger trigger='click' rootClose placement='bottom' overlay={popoverBottom}>
          <IconButton
            className={'highlight-base ' + (color !== '' ? color : 'highlight-default')}
            icon={icon !== '' ? icon : 'eye'}
            id={mod.id}
            tooltip={t('Change Icon')}
          />
        </OverlayTrigger>
      </div>
    );
  }

  private renderHighlightColor(highlightColor: string): JSX.Element {
    return (
      <Button
        type='button'
        key={highlightColor}
        className={'highlight-base ' + highlightColor}
        id={highlightColor}
        value={highlightColor}
        onClick={this.toggleColors}
      >
        <Icon name={highlightColor === 'highlight-default' ? 'minus-circle' : 'plus-circle'} />
      </Button>
    );
  }

  private renderIcons = (icon: string) => {
    return (
      <Button
        type='button'
        key={icon}
        className='btn-embed'
        id={icon}
        value={icon}
        onClick={this.toggleIcon}
      >
        <Icon name={icon} />
      </Button>
    );
  }

  private toggleIcon = (evt) => {
    const { gameMode, mod, onSetModAttribute } = this.props;
    onSetModAttribute(gameMode, mod.id, 'icon', evt.currentTarget.id);
  }

  private toggleColors = (color) => {
    const { gameMode, mod, onSetModAttribute } = this.props;
    onSetModAttribute(gameMode, mod.id, 'color', color.currentTarget.value);
  }

}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => {
      dispatch(setModAttribute(gameMode, modId, attributeId, value));
    },
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    HighlightButton) as React.ComponentClass<IBaseProps>;
