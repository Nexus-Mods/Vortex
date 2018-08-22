import { setSettingsPage } from '../../actions/session';
import Icon from '../../controls/Icon';
import Spinner from '../../controls/Spinner';
import { IExtensionApi, ToDoType } from '../../types/IExtensionContext';
import * as selectors from '../../util/selectors';

import { setProfilesVisible } from '../settings_interface/actions/interface';

import { IToDo } from './IToDo';

import { TranslationFunction } from 'i18next';
import * as React from 'react';

function todos(api: IExtensionApi): IToDo[] {
  const onSetSettingsPage = (pageId: string) => {
    api.store.dispatch(setSettingsPage(pageId));
  };

  const openInterfaceSettings = () => {
    api.events.emit('show-main-page', 'application_settings');
    onSetSettingsPage('Interface');
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
      props: state => ({ gameMode: selectors.activeGameId(state) }),
      condition: props => props.gameMode === undefined,
      text: 'Select a game to manage',
      action: openGames,
    },
    {
      id: 'manual-scan',
      icon: props => props.discoveryRunning
        ? <Spinner />
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
      icon: 'settings',
      type: 'more' as ToDoType,
      props: () => ({}),
      text: 'View Advanced Settings',
      action: openInterfaceSettings,
    },
  ];
}

export default todos;
