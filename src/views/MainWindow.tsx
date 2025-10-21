import { clearUIBlocker, setDialogVisible, setOpenMainPage } from '../actions/session';
import { setTabsMinimized } from '../actions/window';
import Banner from '../controls/Banner';
import DynDiv from '../controls/DynDiv';
import FlexLayout from '../controls/FlexLayout';
import Icon from '../controls/Icon';
import IconBar from '../controls/IconBar';
import ProgressBar from '../controls/ProgressBar';
import Spinner from '../controls/Spinner';
import { Button, NavItem } from '../controls/TooltipControls';
import { IActionDefinition } from '../types/IActionDefinition';
import { IComponentContext } from '../types/IComponentContext';
import { IExtensionApi, IMainPageOptions } from '../types/IExtensionContext';
import { II18NProps } from '../types/II18NProps';
import { IMainPage } from '../types/IMainPage';
import { IModifiers } from '../types/IModifiers';
import { INotification } from '../types/INotification';
import { IProfile, IProgress, IState, IUIBlocker } from '../types/IState';
import { connect, extend } from '../util/ComponentEx';
import { IRegisteredExtension } from '../util/ExtensionManager';
import { TFunction } from '../util/i18n';
import { log } from '../util/log';
import { createQueue, MutexProvider } from '../util/MutexContext';
import startupSettings from '../util/startupSettings';
import { getSafe } from '../util/storeHelper';
import { truthy } from '../util/util';
import Dialog from './Dialog';
import DialogContainer from './DialogContainer';
import DNDContainer from './DNDContainer';
import MainFooter from './MainFooter';
import MainPageContainer from './MainPageContainer';
import NotificationButton from './NotificationButton';
import OverlayContainer from './OverlayContainer';
import PageButton from './PageButton';
import QuickLauncher from './QuickLauncher';
import Settings from './Settings';
import WindowControls from './WindowControls';
import * as semver from 'semver';

import { profileById } from '../extensions/profile_management/selectors';
import { getGame } from '../util/api';

import update from 'immutability-helper';
import * as _ from 'lodash';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import type { ComponentType } from 'react';
import { Button as ReactButton, Nav } from 'react-bootstrap';
// tslint:disable-next-line:no-submodule-imports
import {addStyle} from 'react-bootstrap/lib/utils/bootstrapUtils';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

import { isMacOS } from '../util/platform';

addStyle(ReactButton, 'secondary');
addStyle(ReactButton, 'ad');
addStyle(ReactButton, 'ghost');
addStyle(ReactButton, 'link');
addStyle(ReactButton, 'inverted');

export interface IBaseProps {
  t: TFunction;
  className: string;
  api: IExtensionApi;
}

export interface IExtendedProps {
  objects: IMainPage[];
}

export interface IMainWindowState {
  showLayer: string;
  loadedPages: string[];
  hidpi: boolean;
  focused: boolean;
  menuOpen: boolean;
}

export interface IConnectedProps {
  tabsMinimized: boolean;
  visibleDialog: string;
  mainPage: string;
  secondaryPage: string;
  activeProfileId: string;
  nextProfileId: string;
  progressProfile: { [progressId: string]: IProgress };
  customTitlebar: boolean;
  version: string;  
  updateChannel: string;
  userInfo: any;
  notifications: INotification[];
  uiBlockers: { [id: string]: IUIBlocker };
  profiles: { [key: string]: IProfile };
}

export interface IActionProps {
  onSetTabsMinimized: (minimized: boolean) => void;
  onSetOpenMainPage: (page: string, secondary: boolean) => void;
  onHideDialog: () => void;
  onUnblockUI: (id: string) => void;
}

export type IProps = IBaseProps & IConnectedProps & IExtendedProps & IActionProps & II18NProps;

export const MainContext = React.createContext<IComponentContext>({
  api: undefined,
  getModifiers: undefined,
  menuLayer: undefined,
});

export class MainWindow extends React.Component<IProps, IMainWindowState> {
  // tslint:disable-next-line:no-unused-variable
  public static childContextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  private applicationButtons: IActionDefinition[];

  private settingsPage: IMainPage;
  private nextState: IMainWindowState;
  private globalButtons: IActionDefinition[] = [];
  private modifiers: IModifiers = { alt: false, ctrl: false, shift: false };

  private menuLayer: HTMLDivElement = null;
  private menuObserver: MutationObserver;

  private sidebarRef: HTMLElement = null;
  private sidebarTimer: NodeJS.Timeout;
  private mutexQueue = createQueue();

  constructor(props: IProps) {
    super(props);

    this.state = this.nextState = {
      showLayer: '',
      loadedPages: [],
      hidpi: false,
      focused: true,
      menuOpen: false,
    };

    this.settingsPage = {
      id: 'application_settings',
      title: 'Settings',
      group: 'global',
      component: Settings,
      icon: 'settings',
      propsFunc: () => undefined,
      visible: () => true,
    };

    this.applicationButtons = [];

    this.props.api.events.on('show-main-page', pageId => {
      this.setMainPage(pageId, false);
    });

    this.props.api.events.on('refresh-main-page', () => {
      this.forceUpdate();
    });

    this.props.api.events.on('show-modal', id => {
      this.updateState({
        showLayer: { $set: id },
      });
    });
    
    // Add event handlers for touch bar events
    this.props.api.events.on('refresh-main-window', () => {
      // Refresh the current view
      this.forceUpdate();
      // Also emit a general refresh event that other components can listen to
      this.props.api.events.emit('refresh-content');
    });

    this.props.api.events.on('show-settings', () => {
      // Show the settings page
      this.setMainPage('Settings', false);
    });
    
    // Add event handler for high contrast toggle
    this.props.api.events.on('toggle-high-contrast', (enabled) => {
      // Update the state to trigger a re-render with high contrast styling
      if (enabled) {
        document.body.classList.add('high-contrast');
      } else {
        document.body.classList.remove('high-contrast');
      }
      
      // Force a re-render to apply the new styling
      this.forceUpdate();
    });
  }

  public getChildContext(): IComponentContext {
    const { api } = this.props;
    return { api, menuLayer: this.menuLayer, getModifiers: this.getModifiers };
  }

  public componentDidMount() {
    if (this.props.objects.length > 0) {
      const def = this.props.objects.sort((lhs, rhs) => lhs.priority - rhs.priority)[0];
      this.setMainPage(def.title, false);
    }

    if (this.props.customTitlebar) {
      document.body.classList.add('custom-titlebar-body');
    }
    
    // Add macOS class to body for platform-specific styling
    if (isMacOS()) {
      document.body.classList.add('macOS');
    }

    this.updateSize();

    window.addEventListener('resize', this.updateSize);
    window.addEventListener('keydown', this.updateModifiers);
    window.addEventListener('keyup', this.updateModifiers);
    window.addEventListener('focus', this.setFocus);
    window.addEventListener('blur', this.unsetFocus);
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.updateSize);
    window.removeEventListener('keydown', this.updateModifiers);
    window.removeEventListener('keyup', this.updateModifiers);
    window.removeEventListener('focus', this.setFocus);
    window.removeEventListener('blur', this.unsetFocus);
  }

  public shouldComponentUpdate(nextProps: IProps, nextState: IMainWindowState) {
    return this.props.visibleDialog !== nextProps.visibleDialog
      || this.props.tabsMinimized !== nextProps.tabsMinimized
      || this.props.mainPage !== nextProps.mainPage
      || this.props.secondaryPage !== nextProps.secondaryPage
      || this.props.activeProfileId !== nextProps.activeProfileId
      || this.props.nextProfileId !== nextProps.nextProfileId
      || this.props.customTitlebar !== nextProps.customTitlebar
      || this.props.version !== nextProps.version
      || this.props.updateChannel !== nextProps.updateChannel
      || this.props.userInfo !== nextProps.userInfo
      || this.state.showLayer !== nextState.showLayer
      || this.state.hidpi !== nextState.hidpi
      || this.state.focused !== nextState.focused
      || this.state.menuOpen !== nextState.menuOpen;
  }

  public componentDidUpdate(prevProps: IProps, prevState: IMainWindowState) {
    if ((prevProps.mainPage !== this.props.mainPage)
        || (prevProps.secondaryPage !== this.props.secondaryPage)) {
      this.updateState({
        loadedPages: { $push: [this.props.mainPage] },
      });
    }
  }

  public render(): JSX.Element {
    const { t, visibleDialog, customTitlebar } = this.props;
    const { focused } = this.state;

    const classes = ['main-window'];
    if (customTitlebar) {
      classes.push('custom-titlebar');
    }
    if (!focused) {
      classes.push('blurred');
    }

    return (
      <div className={classes.join(' ')}>
        <MainContext.Provider value={{
          api: this.props.api,
          menuLayer: this.menuLayer,
          getModifiers: this.getModifiers,
        }}>
          {this.renderTitleBar()}
          <FlexLayout type='column' className='main-window-content'>
            <FlexLayout.Fixed className='main-window-header'>
              {this.renderHeader()}
            </FlexLayout.Fixed>
            <FlexLayout.Flex className='main-window-body'>
              {this.renderBody()}
            </FlexLayout.Flex>
            <FlexLayout.Fixed className='main-window-footer'>
              <MainFooter slim={false} />
            </FlexLayout.Fixed>
          </FlexLayout>
          <DialogContainer visibleDialog={visibleDialog} onHideDialog={this.props.onHideDialog} />
          <DNDContainer />
          <OverlayContainer />
          {visibleDialog !== undefined ? <Dialog /> : null}
        </MainContext.Provider>
      </div>
    );
  }

  private updateState = (diff) => {
    this.nextState = update(this.nextState, diff);
    this.setState(this.nextState);
  }

  private getModifiers = (): IModifiers => {
    return this.modifiers;
  }

  private updateModifiers = (evt: KeyboardEvent) => {
    this.modifiers = {
      ctrl: evt.ctrlKey,
      shift: evt.shiftKey,
      alt: evt.altKey,
    };
  }

  private renderTitleBar(): JSX.Element {
    const { customTitlebar, t } = this.props;
    return customTitlebar ? (
      <div className='window-titlebar'>
        <div className='window-title'>{t('Vortex')}</div>
        <WindowControls />
      </div>
    ) : null;
  }

  private renderHeader(): JSX.Element {
    const { t, tabsMinimized } = this.props;
    const { menuOpen } = this.state;

    return (
      <div>
        <IconBar
          id='main-buttons'
          className='main-buttons'
          group='main-toolbar'
          staticElements={this.applicationButtons}
          t={t}
          collapse={tabsMinimized}
        />
        <div className='btn-group' style={{ float: 'right' }}>
          <NotificationButton id='notification-button' hide={false} />
        </div>
      </div>
    );
  }

  private updateSize = () => {
    this.updateState({
      hidpi: { $set: (global.screen?.width ?? 0) > 1920 },
    });
  }

  private setFocus = () => {
    if (process.env.DEBUG_REACT_RENDERS !== 'true') {
      this.updateState({
        focused: { $set: true },
      });
    }
  }

  private unsetFocus = () => {
    if (process.env.DEBUG_REACT_RENDERS !== 'true') {
      this.updateState({
        focused: { $set: false },
      });
    }
  }

  private renderBody() {
    const { t, objects, tabsMinimized } = this.props;

    const sbClass = tabsMinimized ? 'sidebar-compact' : 'sidebar-expanded';

    const pages = objects.map(obj => this.renderPage(obj));
    pages.push(this.renderPage(this.settingsPage));
    const state = this.props.api.getState();
    const profile = profileById(state, this.props.activeProfileId);
    const game = profile !== undefined ? getGame(profile.gameId) : undefined;
    const gameName = game?.shortName || game?.name || 'Mods';
    const pageGroups = [
      { title: undefined, key: 'dashboard' },
      { title: 'General', key: 'global' },
      { title: gameName, key: 'per-game' },
    ];

    return (
      <FlexLayout type='row'>
        <FlexLayout.Fixed className={sbClass}>
          <Nav bsStyle='pills' stacked={true} className='main-nav'>
            {pageGroups.map(group => this.renderPageGroup(group.title, group.key, pages))}
          </Nav>
        </FlexLayout.Fixed>
        <FlexLayout.Flex>
          <MainPageContainer pages={pages} />
        </FlexLayout.Flex>
      </FlexLayout>
    );
  }

  private renderPageGroup(title: string, key: string, pages: JSX.Element[]): JSX.Element {
    const { t } = this.props;
    const groupPages = pages
      .filter(page => page.props.group === key)
      .sort((lhs, rhs) => lhs.props.priority - rhs.props.priority);

    if (groupPages.length === 0) {
      return null;
    }

    return (
      <div key={key}>
        {title !== undefined ? <div className='nav-group-title'>{t(title)}</div> : null}
        {groupPages}
      </div>
    );
  }

  private renderPage(page: IMainPage): JSX.Element {
    const { mainPage, secondaryPage, t } = this.props;
    const visible = (page.id === 'application_settings')
      ? secondaryPage === 'Settings'
      : page.title === mainPage;

    // Only render visible pages
    if (!visible) {
      return null;
    }

    return (
      <PageButton
        key={page.id}
        t={t}
        page={page}
        namespace={undefined}
      />
    );
  }

  private setMainPage = (page: string, secondary: boolean) => {
    const { onSetOpenMainPage } = this.props;
    onSetOpenMainPage(page, secondary);
  }
}

const emptyArray = [];
const emptyObject = {};

function mapStateToProps(state: IState): IConnectedProps {
  return {
    tabsMinimized: state.settings.window.tabsMinimized,
    visibleDialog: state.session.base.visibleDialog,
    mainPage: state.session.base.mainPage,
    secondaryPage: state.session.base.secondaryPage,
    activeProfileId: state.settings.profiles.activeProfileId,
    nextProfileId: state.settings.profiles.nextProfileId,
    progressProfile: getSafe(state, ['session', 'base', 'progress', 'profile'], {}),
    customTitlebar: state.settings.window.customTitlebar,
    version: getSafe(state, ['session', 'base', 'version'], '0.0.0'),
    updateChannel: getSafe(state, ['settings', 'update', 'channel'], 'stable'),
    userInfo: getSafe(state, ['persistent', 'nexus', 'userInfo'], undefined),
    notifications: state.session.notifications.notifications,
    uiBlockers: state.session.base.uiBlockers,
    profiles: state.persistent.profiles,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetTabsMinimized: (minimized: boolean) => dispatch(setTabsMinimized(minimized)),
    onSetOpenMainPage: (page: string, secondary: boolean) =>
      dispatch(setOpenMainPage(page, secondary)),
    onHideDialog: () => dispatch(setDialogVisible(undefined)),
    onUnblockUI: (id: string) => dispatch(clearUIBlocker(id)),
  };
}

const ConnectedMainWindow: React.ComponentType<IBaseProps> =
  connect(mapStateToProps, mapDispatchToProps)(
    MainWindow as React.ComponentClass<IBaseProps>);

export default ConnectedMainWindow;