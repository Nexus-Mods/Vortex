import { setSettingsPage } from '../../actions/session';
import Icon from '../../controls/Icon';
import Spinner from '../../controls/Spinner';
import { IExtensionApi, ToDoType } from '../../types/IExtensionContext';
import * as selectors from '../../util/selectors';

import { setProfilesVisible } from '../settings_interface/actions/interface';

import { IToDo } from './IToDo';

import { TFunction } from 'i18next';
import * as React from 'react';
import * as winapi from 'winapi-bindings';

const ONE_GB = 1024 * 1024 * 1024;
const MIN_DISK_SPACE = 200 * ONE_GB;

const freeSpace: { [key: string]: { path: string, free: number } } = {};

function minDiskSpace(required: number, key: string) {
  return props => {
    const checkPath = props[key];
    if ((freeSpace[key] === undefined) || (freeSpace[key].path !== checkPath)) {
      try {
        freeSpace[key] = {
          path: checkPath,
          free: winapi.GetDiskFreeSpaceEx(checkPath).freeToCaller,
        };
      } catch (err) {
        return false;
      }
    }
    return freeSpace[key].free < required;
  };
}

function todos(api: IExtensionApi): IToDo[] {
  const onSetSettingsPage = (pageId: string) => {
    api.store.dispatch(setSettingsPage(pageId));
  };

  const openSettingsPage = (page: string) => {
    api.events.emit('show-main-page', 'application_settings');
    onSetSettingsPage(page);
  };

  const startManualSearch = () => {
    api.events.emit('start-discovery');
  };

  const openGames = () => {
    api.events.emit('show-main-page', 'Games');
  };

  return [
    {
      id: 'pick-game',
      icon: 'game',
      type: 'search' as ToDoType,
      priority: 10,
      props: state => ({ gameMode: selectors.activeGameId(state) }),
      condition: props => props.gameMode === undefined,
      text: 'Select a game to manage',
      action: openGames,
    },
    {
      id: 'profile-visibility',
      icon: 'profile',
      type: 'settings' as ToDoType,
      priority: 20,
      props: state => ({ profilesVisible: state.settings.interface.profilesVisible }),
      text: 'Profile Management',
      value: (t: TFunction, props: any) => props.profilesVisible ? t('Yes') : t('No'),
      action: (props: any) => api.store.dispatch(setProfilesVisible(!props.profilesVisible)),
    },
    {
      id: 'download-location',
      icon: 'settings',
      type: 'settings' as ToDoType,
      priority: 30,
      props: state => ({ dlPath: selectors.downloadPath(state) }),
      text: 'Downloads are on drive',
      value: (t: TFunction, props: any) => winapi.GetVolumePathName(props.dlPath),
      action: () => {
        openSettingsPage('Download');
        api.highlightControl('#settings-tab-pane-Download #download-path-form', 5000,
          api.translate('You can change the download location here'));
      },
      condition: minDiskSpace(MIN_DISK_SPACE, 'dlPath'),
    },
    {
      id: 'mod-location',
      icon: 'settings',
      type: 'settings' as ToDoType,
      priority: 31,
      props: state => ({ instPath: selectors.installPath(state) }),
      text: 'Mods are staged on drive',
      value: (t: TFunction, props: any) => {
        try {
          return winapi.GetVolumePathName(props.instPath);
        } catch (err) {
          return t('<Invalid Drive>');
        }
      },
      action: () => {
        openSettingsPage('Mods');
        api.highlightControl('#settings-tab-pane-Mods #install-path-form', 5000,
          api.translate('You can change the mod staging location here'));
      },
      condition: minDiskSpace(MIN_DISK_SPACE, 'instPath'),
    },
    {
      id: 'manual-scan',
      icon: props => props.discoveryRunning
        ? <Spinner />
        : <Icon name='search' />,
      type: 'search' as ToDoType,
      priority: 40,
      props: state => ({
        searchPaths: state.settings.gameMode.searchPaths,
        discoveryRunning: state.session.discovery.running,
      }),
      condition: props => props.searchPaths !== undefined,
      text: (t: TFunction, props: any): JSX.Element =>
          props.discoveryRunning
          ? t('Discovery running')
          : t('Scan for missing games'),
      action: startManualSearch,
    },
  ];
}

export default todos;
