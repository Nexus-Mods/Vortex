import {
  DialogActions, DialogType,
  IDialogContent, IDialogResult, showDialog,
} from '../../../actions/notifications';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import { setModColor, setModIcon, setModNotes } from '../actions/mods';

import * as Promise from 'bluebird';
import * as React from 'react';

export interface IBaseProps {
  modId: string;
  gameMode: string;
  t: I18next.TranslationFunction;
  api: IExtensionApi;
}

interface IActionProps {
  onShowDialog: (type: DialogType, title: string,
    content: IDialogContent, actions: DialogActions) => Promise<IDialogResult>;
  onShowError: (message: string, details?: string) => void;
  onSetModColor: (gameMode: string, modId: string, modColor: string) => void;
  onSetModIcon: (gameMode: string, modId: string, icon: string) => void;
  onSetModNotes: (gameMode: string, modId: string, notes: string) => void;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * Highlight Buttons
 * 
 * @class HighlightButtons
 */
class HighlightButtons extends ComponentEx<IProps, {}> {

  public render(): JSX.Element {
    let {modId, t } = this.props;

    return (
      <div style={{ textAlign: 'center' }}>
        <IconButton
          className='btn-embed'
          id={modId}
          value='Color'
          tooltip={t('Change Color')}
          icon={'paint-brush'}
          onClick={this.changeHighlight}
        />
        <IconButton
          className='btn-embed'
          id={modId}
          value='Icon'
          tooltip={t('Change Icon')}
          icon={'eye'}
          onClick={this.changeHighlight}
        />
        <IconButton
          className='btn-embed'
          id={modId}
          value='Notes'
          tooltip={t('Change Notes')}
          icon={'sticky-note'}
          onClick={this.changeHighlight}
        />
      </div>
    );
  }

  private changeHighlight = (evt) => {
    let { api, gameMode, modId, onShowDialog, onSetModColor,
      onSetModIcon, onSetModNotes, t } = this.props;

    if (evt.currentTarget.value === 'Color') {
      let changeColor: boolean;
      let removeCustomColor: boolean;
      let hex: string;

      onShowDialog('question', 'Select color', {
        message:
        t('Select the new row background color. Click Remove to return to the default value.'),
        colors: { id: '', value: undefined },
      }, {
          Cancel: null,
          Remove: null,
          Select: null,
        }).then((result: IDialogResult) => {
          changeColor = result.action === 'Select';
          if (changeColor) {
            hex = result.input.value;
            onSetModColor(gameMode, modId, hex);
          } else {
            removeCustomColor = result.action === 'Remove';
            if (removeCustomColor) {
              onSetModColor(gameMode, modId, undefined);
            }
          }
        });
    } else if (evt.currentTarget.value === 'Notes') {
      let changeNotes: boolean;
      let removeNotes: boolean;
      let notes: string;

      let mods: IMod = api.store.getState().persistent.mods[gameMode];

      onShowDialog('question', 'Add Notes', {
        message:
        t('Add the new Mod Notes.'),
        textArea: {id: modId, value: mods[modId].modNotes},
      }, {
          Cancel: null,
          Remove: null,
          Add: null,
        }).then((result: IDialogResult) => {
          changeNotes = result.action === 'Add';
          if (changeNotes) {

            notes = result.input.value;
            onSetModNotes(gameMode, modId, notes);
          } else {
            removeNotes = result.action === 'Remove';
            if (removeNotes) {
              onSetModIcon(gameMode, modId, undefined);
            }
          }
        });

    } else if (evt.currentTarget.value === 'Icon') {
      let changeIcon: boolean;
      let removeCustomIcon: boolean;
      let icon: string;

      onShowDialog('question', 'Select icon', {
        message:
        t('Select the new icon. Click Remove to return to the default value (no icon).'),
        icons: [
          { id: 'map', value: 'map', selected: false },
          { id: 'flask', value: 'flask', selected: false },
          { id: 'snowflake-o', value: 'snowflake-o', selected: false },
          { id: 'shield', value: 'shield', selected: false },
          { id: 'hotel', value: 'hotel', selected: false },
          { id: 'heart', value: 'heart', selected: false },
          { id: 'bolt', value: 'bolt', selected: false },
          { id: 'bomb', value: 'bomb', selected: false },
          { id: 'home', value: 'home', selected: false }],
      }, {
          Cancel: null,
          Remove: null,
          Select: null,
        }).then((result: IDialogResult) => {
          changeIcon = result.action === 'Select';
          if (changeIcon) {

            icon = result.input.value;
            onSetModIcon(gameMode, modId, icon);
          } else {
            removeCustomIcon = result.action === 'Remove';
            if (removeCustomIcon) {
              onSetModIcon(gameMode, modId, undefined);
            }
          }
        });
    }

  };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
    onSetModColor: (gameMode: string, modId: string, modColor: string) => {
      dispatch(setModColor(gameMode, modId, modColor));
    },
    onSetModIcon: (gameMode: string, modId: string, icon: string) => {
      dispatch(setModIcon(gameMode, modId, icon));
    },
    onSetModNotes: (gameMode: string, modId: string, notes: string) => {
      dispatch(setModNotes(gameMode, modId, notes));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(HighlightButtons)
  ) as React.ComponentClass<IBaseProps>;
