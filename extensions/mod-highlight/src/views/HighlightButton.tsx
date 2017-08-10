import * as React from 'react';
import { Button, ControlLabel, FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import { actions, ComponentEx, Icon, selectors, tooltip, types, util } from 'vortex-api';

const cssHighlightList: string[] = [
  'highlight-1',
  'highlight-2',
  'highlight-3',
  'highlight-4',
  'highlight-5',
  'highlight-default',
];

export interface IBaseProps {
  mod: types.IMod;
  gameMode: string;
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

    const color = util.getSafe(mod.attributes, ['color'], '');
    const icon = util.getSafe(mod.attributes, ['icon'], '');

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
          <tooltip.IconButton
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

function mapStateToProps(state: types.IState): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => {
      dispatch(actions.setModAttribute(gameMode, modId, attributeId, value));
    },
  };
}

export default
translate(['common'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(
    HighlightButton)) as React.ComponentClass<IBaseProps>;
