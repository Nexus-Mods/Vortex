import { ToDoType } from '../../types/IExtensionContext';
import Icon from '../../views/Icon';
import More from '../../views/More';

import getTextModManagement from '../mod_management/texts';
import getTextProfiles from '../profile_management/texts';
import getTextSettingsApplication from '../settings_application/texts';

import { IToDo } from './IToDo';

import { TranslationFunction } from 'i18next';
import * as React from 'react';
import { Interpolate } from 'react-i18next';
import * as selectors from '../../util/selectors';

const todos: IToDo[] = [
  {
    id: 'multi-user',
    type: 'settings-review' as ToDoType,
    condition: props => true,
    priority: 60,
    props: state => ({ multiUser: state.user.multiUser }),
    render: (t: TranslationFunction, props: any): JSX.Element => {
      const { multiUser } = props;

      const mode = multiUser ? t('Shared') : t('Per-user');
      const more = (
        <More id='more-multi-user-dash' name={t('Multi-User Mode')} >
          {getTextSettingsApplication('multi-user', t)}
        </More>
      );

      return (
        <span>
          <Interpolate
            i18nKey='You are currently in {{mode}} {{more}} mode.'
            mode={mode}
            more={more}
          />
        </span>
      );
    },
    button: () => ({
      icon: 'sliders',
      text: this.props.t('Settings'),
      onClick: this.openVortexSettings,
    }),
  },
  {
    id: 'pick-game',
    type: 'search' as ToDoType,
    props: state => ({ gameMode: selectors.activeGameId(state) }),
    condition: props => props.gameMode === undefined,
    render: (t: TranslationFunction, props: any): JSX.Element => {
      return (<span>{t('Select a game to manage')} </span>);
    },
    button: () => ({
      icon: 'gamepad',
      text: this.props.t('Games'),
      onClick: this.openGames,
    }),
  },
  {
    id: 'paths',
    type: 'settings' as ToDoType,
    condition: props => props.gameMode !== undefined,
    props: state => selectors.basePath(state),
    render: (t: TranslationFunction, props: any): JSX.Element => {
      const { basePath } = props;
      const path = <strong>{basePath} </strong>;

      return (
        <span style={{ overflowX: 'hidden', textOverflow: 'ellipsis' }
        }>
          <Interpolate
            i18nKey='Data for this game will be stored in {{path}}.'
            path={path}
          />
        </span>
      );
    },
    button: () => ({
      icon: 'sliders',
      text: this.props.t('Settings'),
      onClick: this.openModsSettings,
    }),
  },
  {
    id: 'manual-search',
    type: 'search' as ToDoType,
    props: state => ({
      searchPaths: state.settings.gameMode.searchPaths,
      discoveryRunning: state.session.discovery.running,
    }),
    condition: props => props.searchPaths !== undefined,
    render: (t: TranslationFunction, props: any): JSX.Element => {
      const { discoveryRunning, searchPaths } = props;

      if (discoveryRunning) {
        return (
          <span>
            <a onClick={this.openGames}>
              {t('Discovery running')} <Icon name='spinner' pulse />
            </a>
          </span>
        );
      } else {
        const gameModeLink =
          <a onClick={this.openGames}><Icon name='gamepad' />{' '}{t('discovered')} </a>;
        const settingsLink = (
          <a onClick={this.openGameSettings} >
            <Icon name='sliders' />
            {searchPaths.sort().join(', ')}
          </a>
        );

        const text = 'If games you have installed weren\'t {{ discovered }}, '
          + 'Vortex can search for them. This can take some time. '
          + 'Currenty these directories will be searched: {{ settings }}.';

        return (
          <span>
            <Interpolate
              i18nKey={text}
              discovered={gameModeLink}
              settings={settingsLink}
            />
          </span>
        );
      }
    },
    button: () => this.props.discoveryRunning ? undefined : ({
      icon: 'gamepad',
      text: this.props.t('Search'),
      onClick: this.startManualSearch,
    }),
  },
  {
    id: 'deploy-automation',
    type: 'automation' as ToDoType,
    props: state => ({ autoDeploy: state.settings.automation.deploy }),
    condition: (props: any) => true,
    render: (t: TranslationFunction, props: any): JSX.Element => {
      const { autoDeploy } = props;
      const enabled = autoDeploy ? t('enabled') : t('disabled');
      const more = (
        <More id='more-deploy-dash' name={t('Deployment')} >
          {getTextModManagement('deployment', t)}
        </More>
      );
      return (
        <span>
          <Interpolate
            i18nKey='Automatic deployment{{more}} is {{enabled}}.'
            more={more}
            enabled={enabled}
          />
        </span>
      );
    },
    button: () => ({
      icon: 'sliders',
      text: this.props.t('Settings'),
      onClick: this.openInterfaceSettings,
    }),
  },
  {
    id: 'profile-visibility',
    type: 'settings' as ToDoType,
    props: state => ({ profilesVisible: state.settings.interface.profilesVisible }),
    condition: (props: any) => !props.profilesVisible,
    render: (t: TranslationFunction, props: any): JSX.Element => {
      const link =
        <a onClick={this.openInterfaceSettings}><Icon name='sliders' />{' '}{t('Settings')} </a>;
      const more = (
        <More id='more-profiles-dash' name={t('Profiles')} >
          {getTextProfiles('profiles', t)}
        </More>
      );
      return (
        <span>
          <Interpolate
            i18nKey='Profile Management{{more}} is disabled. Open {{link}} to enable.'
            more={more}
            link={link}
          />
        </span>
      );
    },
    button: () => ({
      icon: 'sliders',
      text: this.props.t('Settings'),
      onClick: this.openInterfaceSettings,
    }),
  },
];

export default todos;
