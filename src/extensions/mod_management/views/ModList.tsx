import { showDialog } from '../../../actions/notifications';
import { IAttributeState } from '../../../types/IAttributeState';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { SortDirection } from '../../../types/SortDirection';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import SuperTable, {ITableRowAction} from '../../../views/Table';

import { IGameModeSettings } from '../../gamemode_management/types/IStateEx';

import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfileMod } from '../../profile_management/types/IProfile';
import { IProfileSettings } from '../../profile_management/types/IStateEx';

import { removeMod, setModAttribute } from '../actions/mods';
import { setModlistAttributeSort, setModlistAttributeVisible } from '../actions/settings';
import { IMod } from '../types/IMod';
import { IStateMods } from '../types/IStateMods';
import { IStateModSettings } from '../types/IStateSettings';

import { INSTALL_TIME } from '../modAttributes';
import { installPath } from '../selectors';

import InstallArchiveButton from './InstallArchiveButton';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { Jumbotron } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import {createSelector} from 'reselect';
import * as semver from 'semver';

type IModWithState = IMod & IProfileMod;

interface IBaseProps {
  objects: ITableAttribute[];
}

interface IAttributeStateMap {
  [ attributeId: string ]: IAttributeState;
}

interface IModProps {
  mods: { [modId: string]: IMod };
  modState: { [modId: string]: IProfileMod };
}

interface IConnectedProps extends IModProps {
  modlistState: IAttributeStateMap;
  gameMode: string;
  language: string;
  installPath: string;
}

interface IActionProps {
  onSetAttributeVisible: (attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (attributeId: string, dir: SortDirection) => void;
  onSetModAttribute: (modId: string, attributeId: string, value: any) => void;
  onSetModEnabled: (modId: string, enabled: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onRemoveMod: (modId: string) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * displays the list of mods installed for the current game.
 * 
 */
class ModList extends ComponentEx<IProps, {}> {
  private modActions: ITableRowAction[];
  private modEnabledAttribute: ITableAttribute;
  private modNameAttribute: ITableAttribute;
  private modVersionAttribute: ITableAttribute;
  private mModsWithState: { [id: string]: IModWithState };

  constructor(props: IProps) {
    super(props);

    this.modNameAttribute = {
      id: 'name',
      name: 'Mod Name',
      description: 'Name of the mod',
      icon: 'quote-left',
      calc: (mod: IMod) =>
        getSafe(mod.attributes, ['logicalFileName'], getSafe(mod.attributes, ['name'], '')),
      placement: 'both',
      isToggleable: false,
      edit: {
        onChangeValue: (modId: string, value: any) =>
          props.onSetModAttribute(modId, 'logicalFileName', value),
      },
      isSortable: true,
      sortFunc: (lhs: string, rhs: string, locale: string): number => {
        return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
      },
    };

    this.modEnabledAttribute = {
      id: 'enabled',
      name: 'Enabled',
      description: 'Is mod enabled in current profile',
      icon: 'check-o',
      calc: (mod: IModWithState) => mod.enabled || false,
      placement: 'table',
      isToggleable: false,
      edit: {
        onChangeValue: (modId: string, value: any) => props.onSetModEnabled(modId, value),
      },
      isSortable: false,
    };

    this.modVersionAttribute = {
      id: 'version',
      name: 'Version',
      description: 'File version (according to the author)',
      icon: 'birthday-cake',
      calc: (mod: IMod) => getSafe(mod.attributes, ['version'], ''),
      placement: 'both',
      isToggleable: true,
      edit: {
        validate: (input: string) => semver.valid(input) ? 'success' : 'warning',
        onChangeValue: (modId: string, value: any) =>
          props.onSetModAttribute(modId, 'version', value),
      },
      isSortable: true,
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

  public componentWillMount() {
    this.updateModsWithState({ mods: {}, modState: {} }, this.props);
  }

  public updateModsWithState(oldProps: IModProps, newProps: IModProps) {
    let newModsWithState = {};
    Object.keys(newProps.mods).forEach((modId: string) => {
      if ((oldProps.mods[modId] !== newProps.mods[modId])
        || (oldProps.modState[modId] !== newProps.modState[modId])) {
        newModsWithState[modId] = Object.assign({}, newProps.mods[modId], newProps.modState[modId]);
      } else {
        newModsWithState[modId] = this.mModsWithState[modId];
      }
    });
    this.mModsWithState = newModsWithState;
  }

  public componentWillReceiveProps(newProps: IProps) {
    if ((this.props.mods !== newProps.mods)
        || (this.props.modState !== newProps.modState)) {
      this.updateModsWithState(this.props, newProps);
    }
  }

  public render(): JSX.Element {
    const { t, gameMode } = this.props;

    if (gameMode === undefined) {
      return <Jumbotron>{ t('Please select a game first') }</Jumbotron>;
    }

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

            data={this.mModsWithState}
            staticElements={[
              this.modEnabledAttribute,
              this.modNameAttribute,
              this.modVersionAttribute,
              INSTALL_TIME,
            ]}
            actions={this.modActions}
          />
        </Flex>
      </Layout>
      );
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

    onShowDialog('question', 'Confirm deletion', {
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
    onSetModAttribute: (modId: string, attributeId: string, value: any) => {
      dispatch(setModAttribute(modId, attributeId, value));
    },
    onSetModEnabled: (modId: string, enabled: boolean) => {
      dispatch(setModEnabled(modId, enabled));
    },
    onShowDialog:
      (type, title, content, actions) => dispatch(showDialog(type, title, content, actions)),
    onRemoveMod: (modId: string) => dispatch(removeMod(modId)),
  };
}

function registerModAttribute(instance: ModList, attribute: ITableAttribute) {
  return attribute;
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerModAttribute)(ModList)
    )
  ) as React.ComponentClass<{}>;
