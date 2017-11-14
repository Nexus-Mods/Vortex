import { setSettingsPage } from '../../actions/session';
import Icon from '../../controls/Icon';
import More from '../../controls/More';
import { IExtensionApi, ToDoType } from '../../types/IExtensionContext';
import * as selectors from '../../util/selectors';

import getTextModManagement from '../mod_management/texts';
import getTextProfiles from '../profile_management/texts';
import getTextSettingsApplication from '../settings_application/texts';
import { setProfilesVisible } from '../settings_interface/actions/interface';

import { IToDo } from './IToDo';

import { TranslationFunction } from 'i18next';
import * as React from 'react';
import { Interpolate } from 'react-i18next';

function todos(api: IExtensionApi): IToDo[] {
  const onSetSettingsPage = (pageId: string) => {
    api.store.dispatch(setSettingsPage(pageId));
  };

  const openGameSettings = () => {
    api.events.emit('show-main-page', 'Settings');
    onSetSettingsPage('Games');
  };

  const openModsSettings = () => {
    api.events.emit('show-main-page', 'Settings');
    onSetSettingsPage('Mods');
  };

  const openInterfaceSettings = () => {
    api.events.emit('show-main-page', 'Settings');
    onSetSettingsPage('Interface');
  };

  const openVortexSettings = () => {
    api.events.emit('show-main-page', 'Settings');
    onSetSettingsPage('Vortex');
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
      icon: 'gamepad',
      type: 'search' as ToDoType,
      props: state => ({ gameMode: selectors.activeGameId(state) }),
      condition: props => props.gameMode === undefined,
      text: 'Select a game to manage',
      action: openGames,
    },
    {
      id: 'manual-scan',
      icon: props => props.discoveryRunning
        ? <Icon name='spinner' pulse />
        : <Icon name='search' />,
      type: 'search' as ToDoType,
      props: state => ({
        searchPaths: state.settings.gameMode.searchPaths,
        discoveryRunning: state.session.discovery.running,
      }),
      condition: props => props.searchPaths !== undefined,
      text: (t: TranslationFunction, props: any): JSX.Element =>
          props.discoveryRunning
          ? t('Discovery running')
          : t('Scan for Games'),
      action: startManualSearch,
    },
    {
      id: 'profile-visibility',
      icon: 'profile',
      type: 'settings' as ToDoType,
      props: state => ({ profilesVisible: state.settings.interface.profilesVisible }),
      text: 'Profile Management',
      value: (t: TranslationFunction, props: any) => props.profilesVisible ? t('Yes') : t('No'),
      action: (props: any) => api.store.dispatch(setProfilesVisible(!props.profilesVisible)),
    },
    {
      id: 'advanced-settings',
      icon: 'cog',
      type: 'more' as ToDoType,
      props: () => ({}),
      text: 'View Advanced Settings',
      action: openInterfaceSettings,
    },
  ];
}

export default todos;
