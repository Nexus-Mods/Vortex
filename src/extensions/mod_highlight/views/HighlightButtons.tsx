import {
  DialogActions, DialogType,
  IDialogContent, IDialogResult, showDialog,
} from '../../../actions/notifications';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { getSafe } from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import { IconButton } from '../../../views/TooltipControls';

import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';

import * as Promise from 'bluebird';
import * as React from 'react';
import update = require('react-addons-update');
import { Button, ControlLabel, FormGroup, Modal } from 'react-bootstrap';
import { CirclePicker } from 'react-color';

export interface IBaseProps {
  mod: IMod;
  gameMode: string;
  t: I18next.TranslationFunction;
  api: IExtensionApi;
}

interface IActionProps {
  onShowDialog: (type: DialogType, title: string,
    content: IDialogContent, actions: DialogActions) => Promise<IDialogResult>;
  onShowError: (message: string, details?: string) => void;
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
}

export interface IMainWindowState {
  showLayer: string;
  showPage: string;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * Highlight Buttons
 * 
 * @class HighlightButtons
 */
class HighlightButtons extends ComponentEx<IProps, IMainWindowState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      showLayer: '',
      showPage: '',
    };
  }

  public render(): JSX.Element {
    let {mod, t } = this.props;
    let color = getSafe(mod.attributes, ['color'], '');
    let icon = getSafe(mod.attributes, ['icon'], '');

    return (
      <div style={{ textAlign: 'center', background: { color } }}>
        <IconButton
          className='btn-embed'
          style={{ background: color, color: 'black' }}
          icon={icon !== '' ? icon : 'exclamation-circle'}
          id={mod.id}
          tooltip={t('Change Icon')}
          onClick={this.changeHighlight}
        />
        {this.renderModalSettings()}
      </div>
    );
  }

  private renderModalSettings() {
    const { mod, t } = this.props;
    const { showLayer } = this.state;
    let modColors: string[] = ['#ff0000', '#03a9f4', '#4caf50', '#cddc39', '#ff9800'];
    let modIcon: string[] = ['bomb', 'map', 'shield', 'flask', 'hotel', 'bolt', 'home'];
    let color = getSafe(mod.attributes, ['color'], '');
    let icon = getSafe(mod.attributes, ['icon'], '');

    return (
      <Modal
        id='modal-settings'
        show={showLayer === 'settings'}
        onHide={this.hideLayer}
      >
        <Modal.Header>
          <Modal.Title>{t('Highlight Settings')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormGroup key={mod.id}>
          <ControlLabel>{t('Select mod color')}
          </ControlLabel>
          <div key='dialog-form-colors' style={{ background: 'light-grey' }}>
            <CirclePicker
              onChange={this.toggleColors}
              colors={modColors}
              width='100%'
            />
          </div>
          <ControlLabel>{t('Select mod icon')}
          </ControlLabel>
          <div>
            {modIcon.map(this.renderIcons)}
          </div>
          <ControlLabel>{t('Preview')}
          </ControlLabel>
          <div>
            <Icon name={icon !== '' ? icon : 'exclamation-circle'} style={{ background: color }} />
          </div>
          </FormGroup>
        </Modal.Body>
        <Modal.Footer>
          <Button
            id='remove'
            onClick={this.removeHighlights}
          >
            {t('Remove Highlights')}
          </Button>
          <Button
            id='close'
            onClick={this.hideLayer}
          >
            {t('Close')}
          </Button>
        </Modal.Footer>
      </Modal>
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

   private removeHighlights = (evt) => {
    let { gameMode, mod, onSetModAttribute} = this.props;
    onSetModAttribute(gameMode, mod.id, 'icon', '');
    onSetModAttribute(gameMode, mod.id, 'color', '');
  }

  private toggleIcon = (evt) => {
    let { gameMode, mod, onSetModAttribute} = this.props;
    onSetModAttribute(gameMode, mod.id, 'icon', evt.currentTarget.id);
  }

  private toggleColors = (color) => {
    let { gameMode, mod, onSetModAttribute} = this.props;
    onSetModAttribute(gameMode, mod.id, 'color', color.hex);
  }

  private changeHighlight = (evt) => {
    this.showLayer('settings');
  }

  private showLayer = (layer: string) => this.showLayerImpl(layer);
  private hideLayer = () => this.showLayerImpl('');

  private showLayerImpl(layer: string): void {
    this.setState(update(this.state, { showLayer: { $set: layer } }));
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
    onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => {
      dispatch(setModAttribute(gameMode, modId, attributeId, value));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(HighlightButtons)
  ) as React.ComponentClass<IBaseProps>;
