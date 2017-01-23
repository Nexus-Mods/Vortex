import { removeSavegame } from '../actions/session';
import { ISavegame } from '../types/ISavegame';
import { savesPath } from '../util/gameSupport';

import {
  CHARACTER_NAME, CREATION_TIME, FILENAME, LEVEL, LOCATION, PLUGINS,
  SAVEGAME_ID, SCREENSHOT,
} from '../savegameAttributes';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { ComponentEx, ITableRowAction, Table, actions, types } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import {translate} from 'react-i18next';
import {connect} from 'react-redux';

// current typings know neither the function nor the return value
declare var createImageBitmap: (imgData: ImageData) => Promise<any>;

class Dimensions {
  public width: number;
  public height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

interface IProps {
}

interface IConnectedProps {
  saves: { [saveId: string]: ISavegame };
  savesPath: string;
}

interface IActionProps {
  onRemoveSavegame: (savegameId: string) => void;
  onShowDialog: (type: types.DialogType, title: string, content: types.IDialogContent,
    actions: types.DialogActions) => Promise<types.IDialogResult>;
}

interface IComponentState {
  selectedSavegame: string;
}

type Props = IProps & IConnectedProps & IActionProps;

/**
 * displays the list of savegames installed for the current game.
 * 
 */
class SavegameList extends ComponentEx<Props, IComponentState> {
  public screenshotCanvas: HTMLCanvasElement;
  private savegameActions: ITableRowAction[];

  constructor(props) {
    super(props);
    this.state = {
      selectedSavegame: undefined,
    };

    this.savegameActions = [
      {
        icon: 'remove',
        title: props.t('Delete'),
        action: this.remove,
      },
    ];
  }

  public render(): JSX.Element {
    const { saves } = this.props;

    return (
      <Table
        tableId='savegames'
        data={saves}
        actions={this.savegameActions}
        staticElements={[
          SCREENSHOT, SAVEGAME_ID, CHARACTER_NAME, LEVEL,
          LOCATION, FILENAME, CREATION_TIME, PLUGINS]}
      />
    );
  }

  private remove = (instanceIds: string[]) => {
    const { t, savesPath, onRemoveSavegame, onShowDialog } = this.props;

    let removeSavegame = true;

    onShowDialog('question', t('Confirm deletion'), {
      message: t('Do you really want to remove these files?\n{{saveIds}}',
        { replace: { saveIds: instanceIds.join('\n') } }),
      options: {
        translated: true,
      },
    }, {
        Cancel: null,
        Delete: null,
      }).then((result: types.IDialogResult) => {
        removeSavegame = result.action === 'Delete';
        if (removeSavegame) {
          return Promise.map(instanceIds, (id: string) => {
            return fs.removeAsync(path.join(savesPath, id))
            .then(() => {
              onRemoveSavegame(id);
            });
          }).then(() => undefined);
        } else {
          return Promise.resolve();
        }
      });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    saves: state.session.saves.saves,
    savesPath: savesPath(state.settings.gameMode.current),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onRemoveSavegame: (savegameId: string) => dispatch(removeSavegame(savegameId)),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(SavegameList)
  ) as React.ComponentClass<{}>;
