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

import { profileById } from '../util/selectors';
import { getGame } from '../util/api';

import update from 'immutability-helper';
import * as _ from 'lodash';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Button as ReactButton, Nav } from 'react-bootstrap';
// tslint:disable-next-line:no-submodule-imports
import {addStyle} from 'react-bootstrap/lib/utils/bootstrapUtils';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

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
      || this.props.progressProfile !== nextProps.progressProfile
      || this.props.userInfo !== nextProps.userInfo
      || this.props.uiBlockers !== nextProps.uiBlockers
      || this.state.showLayer !== nextState.showLayer
      || this.state.hidpi !== nextState.hidpi
      || this.state.focused !== nextState.focused
      || this.state.menuOpen !== nextState.menuOpen
      ;
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    const page = newProps.objects.find(iter => iter.id === newProps.mainPage);
    if ((page !== undefined) && !page.visible()) {
      this.setMainPage('Dashboard', false);
    }
  }

  public render(): JSX.Element {
    const { activeProfileId, customTitlebar, onHideDialog,
            nextProfileId, uiBlockers, visibleDialog } = this.props;
    const { focused, hidpi, menuOpen } = this.state;

    const switchingProfile = ((activeProfileId !== nextProfileId) && truthy(nextProfileId));

    const classes = [];
    classes.push(hidpi ? 'hidpi' : 'lodpi');
    classes.push(focused ? 'window-focused' : 'window-unfocused');
    if (customTitlebar) {
      // a border around the window if the standard os frame is disabled.
      // this is important to indicate to the user he can resize the window
      // (even though it's not actually this frame that lets him do it)
      classes.push('window-frame');
    }
    if (menuOpen) {
      classes.push('menu-open');
    }

    if (startupSettings.disableGPU) {
      classes.push('no-gpu-acceleration');
    }

    const uiBlocker = truthy(uiBlockers)
      ? Object.keys(uiBlockers).find(() => true)
      : undefined;

    const contextValue = this.getChildContext();

    return (
      <React.Suspense fallback={<Spinner className='suspense-spinner' />}>
        <MainContext.Provider value={contextValue}>
          <MutexProvider value={this.mutexQueue}>
            <div
              key='main'
              className={classes.join(' ')}
            >
              <div className='menu-layer' ref={this.setMenuLayer} />
              <FlexLayout id='main-window-content' type='column'>
                {this.renderToolbar(switchingProfile)}
                {customTitlebar ? <div className='dragbar' /> : null}
                {switchingProfile ? this.renderWait() : this.renderBody()}
              </FlexLayout>
              <Dialog />
              <DialogContainer visibleDialog={visibleDialog} onHideDialog={onHideDialog} />
              <OverlayContainer />
              {customTitlebar ? <WindowControls /> : null}
            </div>
            {(uiBlocker !== undefined)
              ? this.renderBlocker(uiBlocker, uiBlockers[uiBlocker])
              : null}
          </MutexProvider>
        </MainContext.Provider>
      </React.Suspense>
    );
  }

  private getModifiers = () => {
    return this.modifiers;
  }

  private renderWait() {
    const { t, onHideDialog, nextProfileId, profiles, progressProfile, visibleDialog } = this.props;
    const progress = getSafe(progressProfile, ['deploying'], undefined);
    const profile = nextProfileId !== undefined ? profiles[nextProfileId] : undefined;
    const control = (progress !== undefined)
      ? <ProgressBar labelLeft={progress.text} now={progress.percent} style={{ width: '50%' }} />
      : <Spinner style={{ width: 64, height: 64 }} />;
    return (
      <div key='wait'>
        <div className='center-content' style={{ flexDirection: 'column' }}>
          <h4>{
            t('Switching to Profile: {{name}}',
            { replace: { name: profile?.name ?? t('None') } })
          }</h4>
          {control}
        </div>
        <Dialog />
        <DialogContainer visibleDialog={visibleDialog} onHideDialog={onHideDialog} />
      </div>
    );
  }

  private renderBlocker(id: string, blocker: IUIBlocker) {
    const { t } = this.props;
    return (
      <div className='ui-blocker'>
        <Icon name={blocker.icon}/>
        <div className='blocker-text'>{blocker.description}</div>
        {blocker.mayCancel
          ? (
            <ReactButton data-id={id} onClick={this.unblock}>
              {t('Cancel')}
            </ReactButton>
          )
          : null}
      </div>
    );
  }

  private unblock = (evt: React.MouseEvent<any>) => {
    const id = evt.currentTarget.getAttribute('data-id');
    this.props.api.events.emit(`force-unblock-${id}`);
    this.props.onUnblockUI(id);
  }

  private updateModifiers = (event: KeyboardEvent) => {
    const newModifiers = {
      alt: event.altKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
    };
    if (!_.isEqual(newModifiers, this.modifiers)) {
      this.modifiers = newModifiers;
    }
  }

  private updateState(spec: any) {
    this.nextState = update(this.nextState, spec);
    this.setState(this.nextState);
  }

  private renderToolbar(switchingProfile: boolean) {
    const { t, customTitlebar, updateChannel, version } = this.props;
    let parsedVersion = semver.parse(version);
    const prerelease = parsedVersion?.prerelease[0] ?? 'stable';
    const updateChannelClassName = 'toolbar-version-container toolbar-version-' + prerelease;

    const className = customTitlebar ? 'toolbar-app-region' : 'toolbar-default';
    if (switchingProfile) {
      return (<div className={className}/>);
    }
    return (
      <FlexLayout.Fixed id='main-toolbar' className={className}>
        <QuickLauncher t={t} />
        <Banner group='main-toolbar' />
        <DynDiv group='main-toolbar' />
        <div className='flex-fill' />
        <div className='main-toolbar-right'>          
          
          <div className='toolbar-version'>

            {process.env.IS_PREVIEW_BUILD === 'true' ? <div className='toolbar-version-container toolbar-version-staging'>
            <Icon name='conflict'></Icon>
              <div className='toolbar-version-text'>Staging</div>
            </div> : null}

            {process.env.NODE_ENV === 'development' ? <div className='toolbar-version-container toolbar-version-dev'>
              <Icon name='mods'></Icon>
              <div className='toolbar-version-text'>Development</div>
            </div> : null}

            <div className={updateChannelClassName}>
              { prerelease !== 'stable' ? <Icon name='highlight-lab'></Icon> : null }
              <div className='toolbar-version-text'>{version}</div>
            </div>            
          </div>

          <div className='application-icons-group'>
            <IconBar
              className='application-icons'
              group='application-icons'
              staticElements={this.applicationButtons}
              t={t}
            />          
            <NotificationButton id='notification-button' hide={switchingProfile} />
            <IconBar
              id='global-icons'
              className='global-icons'
              group='global-icons'
              staticElements={this.globalButtons}
              orientation='vertical'
              collapse
              t={t}
            />
          </div>
        </div>
      </FlexLayout.Fixed>
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
    const gameName = game?.name || 'Mods';
    const pageGroups = [
      { title: undefined, key: 'dashboard' },
      { title: 'General', key: 'global' },
      { title: gameName, key: 'per-game' },
      { title: 'About', key: 'support' },
    ];

    return (
      <FlexLayout.Flex>
        <FlexLayout type='row' style={{ overflow: 'hidden' }}>
          <FlexLayout.Fixed id='main-nav-sidebar' className={sbClass}>
            <div id='main-nav-container' ref={this.setSidebarRef}>
              {pageGroups.map(this.renderPageGroup)}
            </div>
            <MainFooter slim={tabsMinimized} />
            <Button
              tooltip={tabsMinimized ? t('Restore') : t('Minimize')}
              id='btn-minimize-menu'
              onClick={this.toggleMenu}
              className='btn-menu-minimize'
            >
              <Icon name={tabsMinimized ? 'pane-right' : 'pane-left'} />
            </Button>
          </FlexLayout.Fixed>
          <FlexLayout.Flex fill id='main-window-pane'>
            <DNDContainer style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {pages}
            </DNDContainer>
          </FlexLayout.Flex>
        </FlexLayout>
      </FlexLayout.Flex>
    );
  }

  private renderPageGroup = ({ title, key }: { title: string, key: string }): JSX.Element => {
    const { t, mainPage, objects, tabsMinimized } = this.props;
    const pages = objects.filter(page => {
      try {
        return (page.group === key) && page.visible();
      } catch (err) {
        log('error', 'Failed to determine page visibility', { error: err.message, page: page.id });
        return false;
      }
    });
    if (key === 'global') {
      pages.push(this.settingsPage);
    }

    if (pages.length === 0) {
      return null;
    }

    const showTitle = !tabsMinimized && (title !== undefined);

    return (
      <div key={key}>
        {showTitle ? <p className='main-nav-group-title'>{t(title)}</p> : null}
        <Nav
          bsStyle='pills'
          stacked
          activeKey={mainPage}
          className='main-nav-group'
        >
          {pages.map(this.renderPageButton)}
        </Nav>
      </div>
    );
  }

  private setSidebarRef = ref => {
    this.sidebarRef = ref;
    if (this.sidebarRef !== null) {
      this.sidebarRef.setAttribute('style',
        'min-width: ' + ref.getBoundingClientRect().width + 'px');
    }
  }

  private renderPageButton = (page: IMainPage, idx: number) => {
    const { t, secondaryPage } = this.props;
    return (
      <NavItem
        id={page.id}
        className={secondaryPage === page.id ? 'secondary' : undefined}
        key={page.id}
        eventKey={page.id}
        tooltip={t(page.title, { ns: page.namespace })}
        placement='right'
        onClick={this.handleClickPage}
      >
        <PageButton
          t={this.props.t}
          namespace={page.namespace}
          page={page}
        />
      </NavItem>
    );
  }

  private renderPage(page: IMainPage) {
    const { mainPage, secondaryPage } = this.props;
    const { loadedPages } = this.state;

    if (loadedPages.indexOf(page.id) === -1) {
      // don't render pages that have never been opened
      return null;
    }

    const active = [mainPage, secondaryPage].indexOf(page.id) !== -1;

    return (
      <MainPageContainer
        key={page.id}
        page={page}
        active={active}
        secondary={secondaryPage === page.id}
      />
    );
  }

  private setMenuLayer = (ref) => {
    this.menuLayer = ref;

    if (this.menuObserver !== undefined) {
      this.menuObserver.disconnect();
      this.menuObserver = undefined;
    }

    if (ref !== null) {
      let hasChildren = this.menuLayer.children.length > 0;
      this.menuObserver = new MutationObserver(() => {
        if (this.menuLayer === null) {
          // shouldn't get here but better make sure
          return;
        }
        const newHasChildren = this.menuLayer.children.length > 0;
        if (newHasChildren !== hasChildren) {
          hasChildren = newHasChildren;
          this.updateState({ menuOpen: { $set: hasChildren } });
        }
      });

      this.menuObserver.observe(ref, { childList: true });
    }
  }

  private handleClickPage = (evt: React.MouseEvent<any>) => {
    if (this.props.mainPage !== evt.currentTarget.id) {
      this.setMainPage(evt.currentTarget.id, evt.ctrlKey);
    } else {
      // a second click on the same nav item is treated as a request to "reset"
      // the page, as in: return it to its initial state (without canceling any operations).
      // What that means for an individual page, whether it has an actual effect,
      // is up to the individual page.
      const page = this.props.objects.find(iter => iter.id === this.props.mainPage);
      page?.onReset?.();
    }
  }

  private setMainPage = (pageId: string, secondary: boolean) => {
    // set the page as "loaded", set it as the shown page next frame.
    // this way it gets rendered as hidden once and can then "transition"
    // to visible
    if (this.state.loadedPages.indexOf(pageId) === -1) {
      this.updateState({
        loadedPages: { $push: [pageId] },
      });
    }
    setImmediate(() => {
      if (secondary && (pageId === this.props.secondaryPage)) {
        this.props.onSetOpenMainPage('', secondary);
      } else {
        this.props.onSetOpenMainPage(pageId, secondary);
      }
    });
  }

  private toggleMenu = () => {
    const newMinimized = !this.props.tabsMinimized;
    this.props.onSetTabsMinimized(newMinimized);
    if (this.sidebarTimer !== undefined) {
      clearTimeout(this.sidebarTimer);
      this.sidebarTimer = undefined;
    }
    if (this.sidebarRef !== null) {
      if (newMinimized) {
        this.sidebarRef.setAttribute('style', '');
      } else {
        this.sidebarTimer = setTimeout(() => {
          this.sidebarTimer = undefined;
          this.sidebarRef?.setAttribute?.('style',
            'min-width:' + this.sidebarRef.getBoundingClientRect().width + 'px');
        }, 500);
      }
    }
  }
}

function trueFunc() {
  return true;
}

function emptyFunc() {
  return {};
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    tabsMinimized: getSafe(state, ['settings', 'window', 'tabsMinimized'], false),
    visibleDialog: state.session.base.visibleDialog || undefined,
    mainPage: state.session.base.mainPage,
    secondaryPage: state.session.base.secondaryPage,
    activeProfileId: state.settings.profiles.activeProfileId,
    nextProfileId: state.settings.profiles.nextProfileId,
    profiles: state.persistent.profiles,
    progressProfile: getSafe(state.session.base, ['progress', 'profile'], undefined),
    customTitlebar: state.settings.window.customTitlebar,
    userInfo: getSafe(state, ['persistent', 'nexus', 'userInfo'], undefined),
    notifications: state.session.notifications.notifications,
    uiBlockers: state.session.base.uiBlockers,
    version: state.app.appVersion,
    updateChannel: state.settings.update.channel,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetTabsMinimized: (minimized: boolean) => dispatch(setTabsMinimized(minimized)),
    onSetOpenMainPage:
      (page: string, secondary: boolean) => dispatch(setOpenMainPage(page, secondary)),
    onHideDialog: () => dispatch(setDialogVisible(undefined)),
    onUnblockUI: (id: string) => dispatch(clearUIBlocker(id)),
  };
}

function registerMainPage(
  instanceGroup: undefined,
  extInfo: Partial<IRegisteredExtension>,
  icon: string,
  title: string,
  component: React.ComponentClass<any> | React.StatelessComponent<any>,
  options: IMainPageOptions): IMainPage {
  return {
    id: options.id || title,
    icon,
    title,
    component,
    propsFunc: options.props || emptyFunc,
    visible: options.visible || trueFunc,
    group: options.group,
    badge: options.badge,
    activity: options.activity,
    priority: options.priority !== undefined ? options.priority : 100,
    onReset: options.onReset,
    namespace: extInfo.namespace,
  };
}

export default
  extend(registerMainPage, undefined, true)(
    connect(mapStateToProps, mapDispatchToProps)(
      MainWindow),
  ) as React.ComponentClass<IBaseProps>;
