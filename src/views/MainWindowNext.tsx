/**
 * MainWindowNext - New Tailwind-based main window shell
 * 
 * This is an experimental replacement for MainWindow.tsx that uses Tailwind CSS
 * for styling. It maintains full compatibility with the extension system.
 * 
 * NOTE: This must be a class component to support the legacy context API
 * (childContextTypes/getChildContext) that many Vortex components rely on.
 */

import * as React from 'react';
import * as PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import * as Redux from 'redux';

import { setOpenMainPage, setDialogVisible, clearUIBlocker } from '../actions/session';
import { setTabsMinimized } from '../actions/window';
import Tailwind from '../tailwind';
import { IExtensionApi } from '../types/IExtensionContext';
import { IMainPage } from '../types/IMainPage';
import { IState } from '../types/IState';
import { TFunction } from '../util/i18n';
import { getSafe } from '../util/storeHelper';
import { IComponentContext } from '../types/IComponentContext';
import { IModifiers } from '../types/IModifiers';

import Dialog from './Dialog';
import DialogContainer from './DialogContainer';
import DNDContainer from './DNDContainer';
import MainFooter from './MainFooter';
import MainPageContainer from './MainPageContainer';
import OverlayContainer from './OverlayContainer';
import { MainContext } from './MainWindow';
import { Toaster } from 'react-hot-toast';

// Page group definitions
const PAGE_GROUPS = ['dashboard', 'global', 'per-game', 'support'] as const;
type PageGroup = typeof PAGE_GROUPS[number];

const GROUP_TITLES: Record<PageGroup, string> = {
  'dashboard': '',
  'global': 'General',
  'per-game': 'Game',
  'support': 'Support',
};

export interface IBaseProps {
  t: TFunction;
  className: string;
  api: IExtensionApi;
  objects: IMainPage[];
}

interface IConnectedProps {
  mainPage: string;
  secondaryPage: string;
  tabsMinimized: boolean;
  visibleDialog: string;
  notifications: any[];
  version: string;
  updateChannel: string;
}

interface IActionProps {
  onSetOpenMainPage: (page: string, secondary: boolean) => void;
  onSetTabsMinimized: (minimized: boolean) => void;
  onHideDialog: () => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IMainWindowNextState {
  loadedPages: string[];
}

class MainWindowNext extends React.Component<IProps, IMainWindowNextState> {
  // Legacy context API - required for older class components
  public static childContextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  private modifiers: IModifiers = { alt: false, ctrl: false, shift: false };
  private menuLayer: HTMLDivElement = null;

  constructor(props: IProps) {
    super(props);
    this.state = {
      loadedPages: [],
    };
  }

  // Provide legacy context for older components
  public getChildContext(): IComponentContext {
    const { api } = this.props;
    return {
      api,
      menuLayer: this.menuLayer,
      getModifiers: this.getModifiers,
    };
  }

  public componentDidMount() {
    // Set initial page if needed
    if (this.props.objects.length > 0 && !this.props.mainPage) {
      const firstPage = this.props.objects.sort((a, b) => 
        (a.priority || 100) - (b.priority || 100)
      )[0];
      this.setMainPage(firstPage.id, false);
    }

    window.addEventListener('keydown', this.updateModifiers);
    window.addEventListener('keyup', this.updateModifiers);
  }

  public componentWillUnmount() {
    window.removeEventListener('keydown', this.updateModifiers);
    window.removeEventListener('keyup', this.updateModifiers);
  }

  public render() {
    const { t, objects, mainPage, secondaryPage, tabsMinimized, 
            visibleDialog, notifications, version, updateChannel } = this.props;

    const contextValue = this.getChildContext();

    // Group and sort pages
    const groupedPages = this.getGroupedPages();

    return (
      <MainContext.Provider value={contextValue}>
        <div className="tw:flex tw:flex-col tw:h-screen tw:bg-surface-lowest tw:text-neutral-base">
          {/* Header */}
          <header className="tw:flex tw:items-center tw:h-12 tw:px-4 tw:bg-surface-low tw:border-b tw:border-stroke-low tw:gap-4">
            {/* Left: App title */}
            <div className="tw:flex tw:items-center tw:gap-2">
              <Tailwind.Icon path="nexus" size="md" className="tw:text-primary-base" />
              {!tabsMinimized && (
                <Tailwind.Typography type="heading-sm" className="tw:text-neutral-strong">
                  Vortex
                </Tailwind.Typography>
              )}
            </div>
            
            {/* Center: New UI badge */}
            <div className="tw:flex tw:items-center tw:gap-2 tw:ml-4">
              <span className="tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:bg-primary-base tw:text-white tw:rounded">
                New UI
              </span>
            </div>
            
            {/* Spacer */}
            <div className="tw:flex-1" />
            
            {/* Right: Version and notifications */}
            <div className="tw:flex tw:items-center tw:gap-3">
              <span className={`tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:text-white tw:rounded ${this.getChannelColor()}`}>
                v{version}
              </span>
              <button className="tw:relative tw:p-2 tw:rounded-lg hover:tw:bg-surface-high tw:transition-colors">
                <Tailwind.Icon path="notifications" size="md" className="tw:text-neutral-subdued" />
                {notifications.length > 0 && (
                  <span className="tw:absolute tw:top-1 tw:right-1 tw:w-2 tw:h-2 tw:bg-danger-base tw:rounded-full" />
                )}
              </button>
            </div>
          </header>

          {/* Body */}
          <div className="tw:flex tw:flex-1 tw:overflow-hidden">
            {/* Sidebar */}
            <aside 
              className={`
                tw:flex tw:flex-col tw:bg-surface-low tw:border-r tw:border-stroke-low
                tw:transition-all tw:duration-200
                ${tabsMinimized ? 'tw:w-16' : 'tw:w-56'}
              `}
            >
              {/* Navigation */}
              <div className="tw:flex tw:flex-1 tw:flex-col tw:overflow-y-auto tw:p-2">
                {PAGE_GROUPS.map(group => this.renderPageGroup(group, groupedPages))}
              </div>
              
              {/* Footer */}
              <div className="tw:p-2 tw:border-t tw:border-stroke-low">
                <MainFooter slim={tabsMinimized} />
              </div>
              
              {/* Collapse toggle */}
              <button
                onClick={this.toggleSidebar}
                className="tw:p-2 tw:border-t tw:border-stroke-low hover:tw:bg-surface-high tw:transition-colors"
                title={tabsMinimized ? t('Expand sidebar') : t('Collapse sidebar')}
              >
                <Tailwind.Icon 
                  path={tabsMinimized ? 'chevron-right' : 'chevron-left'} 
                  size="sm" 
                  className="tw:text-neutral-muted tw:mx-auto"
                />
              </button>
            </aside>

            {/* Main content */}
            <main className="tw:flex tw:flex-1 tw:overflow-hidden tw:bg-surface-base">
                {objects.map(page => this.renderPage(page))}
            </main>
          </div>

          {/* Menu layer for dropdowns */}
          <div ref={this.setMenuLayer} />
          
          {/* Dialog system */}
          <Dialog />
          <DialogContainer 
            visibleDialog={visibleDialog} 
            onHideDialog={this.props.onHideDialog} 
          />
          <OverlayContainer />
          <Toaster />
        </div>
      </MainContext.Provider>
    );
  }

  private getModifiers = (): IModifiers => {
    return this.modifiers;
  }

  private updateModifiers = (event: KeyboardEvent) => {
    this.modifiers = {
      alt: event.altKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
    };
  }

  private setMenuLayer = (ref: HTMLDivElement) => {
    this.menuLayer = ref;
  }

  private getGroupedPages(): Record<PageGroup, IMainPage[]> {
    const { objects } = this.props;
    const groups: Record<PageGroup, IMainPage[]> = {
      'dashboard': [],
      'global': [],
      'per-game': [],
      'support': [],
    };
    
    objects.forEach(page => {
      const group = (page.group as PageGroup) || 'global';
      if (groups[group]) {
        groups[group].push(page);
      } else {
        groups['global'].push(page);
      }
    });
    
    // Sort each group by priority
    Object.keys(groups).forEach(key => {
      groups[key as PageGroup].sort((a, b) => (a.priority || 100) - (b.priority || 100));
    });
    
    return groups;
  }

  private renderPageGroup(group: PageGroup, groupedPages: Record<PageGroup, IMainPage[]>) {
    const { t, tabsMinimized } = this.props;
    const pages = groupedPages[group];
    if (pages.length === 0) return null;
    
    const title = GROUP_TITLES[group];
    
    return (
      <div key={group} className="tw:mb-4">
        {title && !tabsMinimized && (
          <div className="tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:text-neutral-muted tw:uppercase tw:tracking-wider">
            {t(title)}
          </div>
        )}
        <nav className="tw:space-y-1">
          {pages.map(page => this.renderNavItem(page))}
        </nav>
      </div>
    );
  }

  private renderNavItem(page: IMainPage) {
    const { t, mainPage, tabsMinimized } = this.props;
    const isActive = mainPage === page.id;
    
    let isVisible = true;
    try {
      isVisible = page.visible?.() ?? true;
    } catch (err) {
      // ignore visibility errors
    }
    
    if (!isVisible) return null;
    
    return (
      <button
        key={page.id}
        onClick={() => this.handleSelectPage(page.id)}
        className={`
          tw:w-full tw:flex tw:items-center tw:gap-3 tw:px-3 tw:py-2 tw:rounded-lg
          tw:text-left tw:transition-colors tw:duration-150
          ${isActive 
            ? 'tw:bg-primary-base tw:text-white' 
            : 'tw:text-neutral-subdued hover:tw:bg-surface-high hover:tw:text-neutral-strong'}
          ${tabsMinimized ? 'tw:justify-center' : ''}
        `}
        title={tabsMinimized ? t(page.title) : undefined}
      >
        <Tailwind.Icon 
          path={page.icon || 'placeholder'} 
          size="md" 
          className={isActive ? 'tw:text-white' : 'tw:text-neutral-muted'}
        />
        {!tabsMinimized && (
          <span className="tw:truncate">{t(page.title)}</span>
        )}
        {page.badge && !tabsMinimized && (
          <span className="tw:ml-auto tw:px-2 tw:py-0.5 tw:text-xs tw:bg-danger-base tw:text-white tw:rounded-full">
            {typeof page.badge === 'object' ? (page.badge as any).calculate?.() : page.badge}
          </span>
        )}
      </button>
    );
  }

  private renderPage(page: IMainPage) {
    const { mainPage, secondaryPage } = this.props;
    const { loadedPages } = this.state;

    // Don't render pages that have never been opened
    if (!loadedPages.includes(page.id)) {
      return null;
    }

    const active = mainPage === page.id || secondaryPage === page.id;

    return (
      <MainPageContainer
        key={page.id}
        page={page}
        active={active}
        secondary={secondaryPage === page.id}
      />
    );
  }

  private handleSelectPage = (pageId: string) => {
    this.setMainPage(pageId, false);
  }

  private setMainPage(pageId: string, secondary: boolean) {
    const { loadedPages } = this.state;
    
    if (!loadedPages.includes(pageId)) {
      this.setState({
        loadedPages: [...loadedPages, pageId],
      });
    }
    
    setImmediate(() => {
      this.props.onSetOpenMainPage(pageId, secondary);
    });
  }

  private toggleSidebar = () => {
    this.props.onSetTabsMinimized(!this.props.tabsMinimized);
  }

  private getChannelColor(): string {
    switch (this.props.updateChannel) {
      case 'beta': return 'tw:bg-warning-base';
      case 'next': return 'tw:bg-danger-base';
      default: return 'tw:bg-success-base';
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    mainPage: state.session.base.mainPage,
    secondaryPage: state.session.base.secondaryPage,
    tabsMinimized: getSafe(state, ['settings', 'window', 'tabsMinimized'], false),
    visibleDialog: state.session.base.visibleDialog || undefined,
    notifications: state.session.notifications.notifications,
    version: state.app.appVersion,
    updateChannel: state.settings.update.channel,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetOpenMainPage: (page: string, secondary: boolean) => 
      dispatch(setOpenMainPage(page, secondary)),
    onSetTabsMinimized: (minimized: boolean) => 
      dispatch(setTabsMinimized(minimized)),
    onHideDialog: () => 
      dispatch(setDialogVisible(undefined)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(MainWindowNext) as unknown as React.ComponentClass<IBaseProps>;
