import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import { IconButton } from '../../../views/TooltipControls';

import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';

import { Button, ControlLabel, FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';
import { CirclePicker } from 'react-color';

export interface IBaseProps {
  mod: IMod;
  gameMode: string;
  t: I18next.TranslationFunction;
}

interface IActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
}

export interface IHighlightButtonState {
  showLayer: string;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * Highlight Button
 * 
 * @class HighlightButton
 */
class HighlightButton extends ComponentEx<IProps, IHighlightButtonState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      showLayer: '',
    };
  }

  public render(): JSX.Element {
    let {mod, t } = this.props;
    let color = getSafe(mod.attributes, ['color'], '');
    let icon = getSafe(mod.attributes, ['icon'], '');
    let modColors: string[] = ['#ff0000', '#03a9f4', '#4caf50', '#cddc39', '#ff9800', '#ffffff'];
    let modIcon: string[] = ['bomb', 'map', 'shield', 'flask',
     'flag', 'hotel', 'bolt', 'home', 'eye'];
    let spacing: number = 10;
    let highlightClassName = '';

    switch (color) {
      case '#ff0000':
        highlightClassName = 'color-highlight-1';
        break;
      case '#03a9f4':
        highlightClassName = 'color-highlight-2';
        break;
      case '#4caf50':
        highlightClassName = 'color-highlight-3';
        break;
      case '#cddc39':
        highlightClassName = 'color-highlight-4';
        break;
      case '#ff9800':
        highlightClassName = 'color-highlight-5';
        break;

      default:
        highlightClassName = 'btn-embed';
        break;
    }

    const popoverBottom = (
      <Popover
        id='popover-positioned-scrolling-bottom'
        className='modlist-selected'
        title={t('Highlight Settings')}
      >
        <FormGroup key={mod.id}>
          <ControlLabel>{t('Select mod color')}
          </ControlLabel>
          <div key='dialog-form-colors'>
            <CirclePicker
              onChange={this.toggleColors}
              colors={modColors}
              width='100%'
              circleSpacing={spacing}
            />
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
      <div style={{textAlign:'center'}}>
        <OverlayTrigger trigger='click' rootClose placement='bottom' overlay={popoverBottom}>
          <IconButton
            className={highlightClassName}
            icon={icon !== '' ? icon : 'eye'}
            id={mod.id}
            tooltip={t('Change Icon')}
          />
        </OverlayTrigger>
      </div>
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
    let { gameMode, mod, onSetModAttribute} = this.props;
    onSetModAttribute(gameMode, mod.id, 'icon', evt.currentTarget.id);
  }

  private toggleColors = (color) => {
    let { gameMode, mod, onSetModAttribute} = this.props;
    onSetModAttribute(gameMode, mod.id, 'color', color.hex);
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
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(HighlightButton)
  ) as React.ComponentClass<IBaseProps>;
