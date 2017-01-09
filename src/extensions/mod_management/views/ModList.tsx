import { showDialog } from '../../../actions/notifications';
import { IAttributeState } from '../../../types/IAttributeState';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { SortDirection } from '../../../types/SortDirection';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';
import SuperTable, {ITableRowAction} from '../../../views/Table';

import { IGameModeSettings } from '../../gamemode_management/types/IStateEx';

import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfile, IProfileMod } from '../../profile_management/types/IProfile';
import { IProfileSettings } from '../../profile_management/types/IStateEx';

import { removeMod } from '../actions/mods';
import { setModlistAttributeSort, setModlistAttributeVisible } from '../actions/settings';
import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';
import { IStateMods } from '../types/IStateMods';
import { IStateModSettings } from '../types/IStateSettings';

import { INSTALL_TIME, MOD_NAME, VERSION } from '../modAttributes';
import { installPath } from '../selectors';

import InstallArchiveButton from './InstallArchiveButton';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { Jumbotron } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import update = require('react-addons-update');
import {createSelector} from 'reselect';

import { log } from '../../../util/log';

type IModWithState = IMod & IProfileMod;

interface IBaseProps {
  objects: IModAttribute[];
}

interface IAttributeStateMap {
  [ attributeId: string ]: IAttributeState;
}

interface IConnectedProps {
  mods: { [modId: string]: IMod };
  modState: { [modId: string]: IProfileMod };
  modlistState: IAttributeStateMap;
  gameMode: string;
  language: string;
  installPath: string;
}

interface IActionProps {
  onSetAttributeVisible: (attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (attributeId: string, dir: SortDirection) => void;
  onSetModEnabled: (modId: string, enabled: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onRemoveMod: (modId: string) => void;
}

interface IRowState {
  selected: boolean;
}

interface IComponentState {
  tableState: { [id: string]: IRowState };
  lastSelected: string;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * displays the list of mods installed for the current game.
 * 
 */
class ModList extends ComponentEx<IProps, IComponentState> {
  private modActions: ITableRowAction[];
  private modEnabledAttribute: IModAttribute;

  constructor(props: IProps) {
    super(props);
    this.state = {
      tableState: {},
      lastSelected: undefined,
    };

    this.modEnabledAttribute = {
      id: 'enabled',
      name: 'Enabled',
      description: 'Is mod enabled in current profile',
      icon: 'check-o',
      calc: (mod: IModWithState) => mod.enabled,
      isDetail: false,
      isToggleable: false,
      isReadOnly: false,
      isSortable: false,
    };

    this.modActions = [
      {
        icon: 'check-square-o',
        title: 'Enable selected',
        action: this.enableSelected,
        singleRowAction: false,
      },
      {
        icon: 'square-o',
        title: 'Disable selected',
        action: this.disableSelected,
        singleRowAction: false,
      },
      {
        icon: 'remove',
        title: 'Remove',
        action: this.removeSelected,
      },
    ];
  }

  public componentDidUpdate(prevProps: IBaseProps, prevState: IComponentState) {
    const { mods }  = this.props;
    const { lastSelected } = this.state;

    // after a removal the selected mod will no longer be here
    if ((lastSelected !== undefined) && !(lastSelected in mods))  {
      this.setState(update(this.state, {
        lastSelected: { $set: undefined },
        tableState: {
          [lastSelected]: { selected: { $set: false } },
        },
      }));
    }
  }

  public render(): JSX.Element {
    const { t, modState, mods, gameMode } = this.props;

    if (gameMode === undefined) {
      return <Jumbotron>{ t('Please select a game first') }</Jumbotron>;
    }

    let modsWithState: { [id: string]: IModWithState } = {};
    Object.keys(mods).forEach((modId: string) => {
      modsWithState[modId] = Object.assign({}, mods[modId], modState[modId]);
    });

    return (
      <Layout type='column'>
        <Fixed>
          <div>
            <InstallArchiveButton />
          </div>
        </Fixed>
        <Flex>
          <SuperTable
            tableId='mods'
            data={modsWithState}
            staticElements={[this.modEnabledAttribute, MOD_NAME, VERSION, INSTALL_TIME]}
            actions={this.modActions}
            onChangeData={this.handleChangeData}
          />
        </Flex>
      </Layout>
      );
  }

  private handleChangeData = (modId: string, attributeId: string, value: any) => {
    if (attributeId === this.modEnabledAttribute.id) {
      this.props.onSetModEnabled(modId, value);
    }
  }

  private enableSelected = (modIds: string[]) => {
    const { modState, onSetModEnabled } = this.props;

    modIds.forEach((key: string) => {
      if (!modState[key].enabled) {
        onSetModEnabled(key, true);
      }
    });
  }

  private disableSelected = (modIds: string[]) => {
    const { modState, onSetModEnabled } = this.props;

    modIds.forEach((key: string) => {
      if (modState[key].enabled) {
        onSetModEnabled(key, false);
      }
    });
  }

  private removeSelected = (modIds: string[]) => {
    const { t, installPath, onRemoveMod, onShowDialog, mods } = this.props;

    let removeMods: boolean;
    let removeArchive: boolean;
    let disableDependent: boolean;

    onShowDialog('question', 'Confirm Removal', {
      message: t('Do you really want to delete this mod?',
        { count: modIds.length, replace: { count: modIds.length } }) + '\n' + modIds.join('\n'),
      checkboxes: [
        { id: 'mod', text: t('Remove Mod'), value: true },
        { id: 'archive', text: t('Remove Archive'), value: false },
        { id: 'dependents', text: t('Disable Dependent'), value: false },
      ],
    }, {
        Cancel: null,
        Remove: null,
      }).then((result: IDialogResult) => {
        removeMods = result.action === 'Remove' && result.input.mod;
        removeArchive = result.action === 'Remove' && result.input.archive;
        disableDependent = result.action === 'Remove' && result.input.dependents;

        if (removeMods) {
          return Promise.map(modIds, (key: string) => {
            let fullPath = path.join(installPath, mods[key].installationPath);
            return fs.removeAsync(fullPath);
          }).then(() => undefined);
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        modIds.forEach((key: string) => {
          if (removeMods) {
            onRemoveMod(key);
          }
          if (removeArchive) {
            this.context.api.events.emit('remove-download', mods[key].archiveId);
          }
        });
      });
  }
}

interface IState {
  settings: {
    gameMode: IGameModeSettings
    interface: {
      language: string
    }
  };
  gameSettings: {
    mods: IStateModSettings,
    profiles: IProfileSettings,
  };
  mods: IStateMods;
}

const currentProfile = (state) =>
  state.gameSettings.profiles.profiles[state.gameSettings.profiles.currentProfile];

const modState = createSelector(currentProfile,
  (profile) => profile !== undefined ? profile.modState : {});

function mapStateToProps(state: IState): IConnectedProps {
  return {
    mods: state.mods.mods,
    modState: modState(state),
    modlistState: state.gameSettings.mods.modlistState,
    gameMode: state.settings.gameMode.current,
    language: state.settings.interface.language,
    installPath: installPath(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAttributeVisible: (attributeId: string, visible: boolean) => {
      dispatch(setModlistAttributeVisible(attributeId, visible));
    },
    onSetAttributeSort: (attributeId: string, dir: SortDirection) => {
      dispatch(setModlistAttributeSort(attributeId, dir));
    },
    onSetModEnabled: (modId: string, enabled: boolean) => {
      dispatch(setModEnabled(modId, enabled));
    },
    onShowDialog:
      (type, title, content, actions) => dispatch(showDialog(type, title, content, actions)),
    onRemoveMod: (modId: string) => dispatch(removeMod(modId)),
  };
}

function registerModAttribute(instance: ModList, attribute: IModAttribute) {
  return attribute;
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerModAttribute)(ModList)
    )
  ) as React.ComponentClass<{}>;
