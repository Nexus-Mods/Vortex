import { showDialog } from '../../../actions/notifications';
import { IAttributeState } from '../../../types/IAttributeState';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';
import { activeGameId, activeProfile } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import SuperTable, {ITableRowAction} from '../../../views/Table';

import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { removeMod, setModAttribute } from '../actions/mods';
import { IMod } from '../types/IMod';

import { INSTALL_TIME } from '../modAttributes';
import { installPath } from '../selectors';

import InstallArchiveButton from './InstallArchiveButton';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { Jumbotron } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';
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
  gameMode: string;
  profileId: string;
  language: string;
  installPath: string;
}

interface IActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
  onSetModEnabled: (profileId: string, modId: string, enabled: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onRemoveMod: (gameMode: string, modId: string) => void;
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
          props.onSetModAttribute(props.gameMode, modId, 'logicalFileName', value),
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
        onChangeValue: (modId: string, value: any) =>
          props.onSetModEnabled(props.profileId, modId, value),
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
          props.onSetModAttribute(props.gameMode, modId, 'version', value),
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
    const { profileId, modState, onSetModEnabled } = this.props;

    modIds.forEach((key: string) => {
      if (!getSafe(modState, [key, 'enabled'], false)) {
        onSetModEnabled(profileId, key, true);
      }
    });
  }

  private disableSelected = (modIds: string[]) => {
    const { profileId, modState, onSetModEnabled } = this.props;

    modIds.forEach((key: string) => {
      if (getSafe(modState, [key, 'enabled'], false)) {
        onSetModEnabled(profileId, key, false);
      }
    });
  }

  private removeSelected = (modIds: string[]) => {
    const { t, gameMode, installPath, onRemoveMod, onShowDialog, mods } = this.props;

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
            onRemoveMod(gameMode, key);
          }
          if (removeArchive) {
            this.context.api.events.emit('remove-download', mods[key].archiveId);
          }
        });
      });
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  const profile = activeProfile(state);
  const gameMode = activeGameId(state);

  return {
    mods: state.persistent.mods[gameMode] || {},
    modState: profile !== undefined ? profile.modState : {},
    gameMode,
    profileId: profile.id,
    language: state.settings.interface.language,
    installPath: installPath(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => {
      dispatch(setModAttribute(gameMode, modId, attributeId, value));
    },
    onSetModEnabled: (profileId: string, modId: string, enabled: boolean) => {
      dispatch(setModEnabled(profileId, modId, enabled));
    },
    onShowDialog:
      (type, title, content, actions) => dispatch(showDialog(type, title, content, actions)),
    onRemoveMod: (gameMode: string, modId: string) => dispatch(removeMod(gameMode, modId)),
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
