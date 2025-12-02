/**
 * MainWindowNext - New Tailwind-based main window shell
 * 
 * This is an experimental replacement for MainWindow.tsx that uses Tailwind CSS
 * for styling. It maintains full compatibility with the extension system.
 */

import * as React from 'react';
import * as PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import * as Redux from 'redux';

import { setOpenMainPage, setDialogVisible } from '../actions/session';
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

export interface IMainWindowNextProps {
  t: TFunction;
  className: string;
  api: IExtensionApi;
  objects: IMainPage[];
}

/**
 * LegacyContextProvider - Thin class wrapper that provides legacy React context
 * 
 * Many Vortex components use the old contextTypes/getChildContext API.
 * Functional components cannot provide legacy context, so we use this minimal
 * class wrapper to bridge the gap.
 */
class LegacyContextProvider extends React.Component<{
  api: IExtensionApi;
  menuLayer: HTMLDivElement | null;
  getModifiers: () => IModifiers;
  children: React.ReactNode;
}> {
  public static childContextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  public getChildContext(): IComponentContext {
    return {
      api: this.props.api,
      menuLayer: this.props.menuLayer,
      getModifiers: this.props.getModifiers,
    };
  }

  public render() {
    return this.props.children;
  }
}

/**
 * MainWindowNextContent - The actual functional component with all the UI logic
 */
function MainWindowNextContent(props: IMainWindowNextProps) {
  const { t, api, objects } = props;
  const dispatch = useDispatch<ThunkDispatch<IState, null, Redux.Action>>();

  // Redux state
  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const secondaryPage = useSelector((state: IState) => state.session.base.secondaryPage);
  const tabsMinimized = useSelector((state: IState) =>
    getSafe(state, ['settings', 'window', 'tabsMinimized'], false));
  const visibleDialog = useSelector((state: IState) =>
    state.session.base.visibleDialog || undefined);
  const notifications = useSelector((state: IState) =>
    state.session.notifications.notifications);
  const version = useSelector((state: IState) => state.app.appVersion);
  const updateChannel = useSelector((state: IState) => state.settings.update.channel);

  // Local state
  const [loadedPages, setLoadedPages] = React.useState<string[]>([]);
  const modifiersRef = React.useRef<IModifiers>({ alt: false, ctrl: false, shift: false });
  const [menuLayer, setMenuLayer] = React.useState<HTMLDivElement | null>(null);

  // Set initial page
  React.useEffect(() => {
    if (objects.length > 0 && !mainPage) {
      const firstPage = [...objects].sort((a, b) =>
        (a.priority || 100) - (b.priority || 100)
      )[0];
      if (firstPage) {
        handleSelectPage(firstPage.id);
      }
    }
  }, [objects, mainPage]);

  // Keyboard modifiers tracking
  React.useEffect(() => {
    const updateModifiers = (event: KeyboardEvent) => {
      modifiersRef.current = {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
      };
    };

    window.addEventListener('keydown', updateModifiers);
    window.addEventListener('keyup', updateModifiers);

    return () => {
      window.removeEventListener('keydown', updateModifiers);
      window.removeEventListener('keyup', updateModifiers);
    };
  }, []);

  // Callback ref for menu layer
  const menuLayerRef = React.useCallback((node: HTMLDivElement | null) => {
    setMenuLayer(node);
  }, []);

  const getModifiers = React.useCallback(() => modifiersRef.current, []);

  // Group and sort pages
  const groupedPages = React.useMemo(() => {
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
  }, [objects]);

  // Handle page navigation
  const handleSelectPage = React.useCallback((pageId: string, secondary: boolean = false) => {
    if (!loadedPages.includes(pageId)) {
      setLoadedPages(prev => [...prev, pageId]);
    }
    setImmediate(() => {
      dispatch(setOpenMainPage(pageId, secondary));
    });
  }, [dispatch, loadedPages]);

  // Toggle sidebar
  const toggleSidebar = React.useCallback(() => {
    dispatch(setTabsMinimized(!tabsMinimized));
  }, [dispatch, tabsMinimized]);

  // Hide dialog
  const hideDialog = React.useCallback(() => {
    dispatch(setDialogVisible(undefined));
  }, [dispatch]);

  // Version badge color
  const getChannelColor = () => {
    switch (updateChannel) {
      case 'beta': return 'tw:bg-warning-base';
      case 'next': return 'tw:bg-danger-base';
      default: return 'tw:bg-success-base';
    }
  };

  // Render navigation item
  const renderNavItem = (page: IMainPage) => {
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
        onClick={() => handleSelectPage(page.id)}
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
  };

  // Render page group
  const renderPageGroup = (group: PageGroup) => {
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
          {pages.map(renderNavItem)}
        </nav>
      </div>
    );
  };

  // Render page container
  const renderPage = (page: IMainPage) => {
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
  };

  // Context value for new Context API
  const contextValue: IComponentContext = {
    api,
    menuLayer,
    getModifiers,
  };

  return (
    <LegacyContextProvider api={api} menuLayer={menuLayer} getModifiers={getModifiers}>
      <MainContext.Provider value={contextValue}>

        {/* new layout */}
        <div className="tw:flex tw:flex-col tw:h-screen tw:bg-surface-base tw:text-neutral-moderate tw:overflow-hidden"
        // onDragEnter={onDragEnter}
        // onDragOver={onDragOver}
        // onDragLeave={onDragLeave}
        // onDrop={onDrop}
        >
          {/* toolbar */}
          <header
            role="banner"
            className="tw:h-9 tw:shrink-0 tw:flex tw:flex-row tw:items-center tw:border-b tw:border-stroke-neutral-translucent-weak"
          >
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
              <span className={`tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:text-white tw:rounded ${getChannelColor()}`}>
                v{version}
              </span>
              <button className="tw:relative tw:p-2 tw:rounded-lg tw:hover:bg-surface-high tw:transition-colors">
                <Tailwind.Icon path="notifications" size="md" className="tw:text-neutral-subdued" />
                {notifications.length > 0 && (
                  <span className="tw:absolute tw:top-1 tw:right-1 tw:w-2 tw:h-2 tw:bg-danger-base tw:rounded-full" />
                )}
              </button>
            </div>
          </header>
          <div className="tw:flex tw:flex-1 tw:min-h-0">
            {/* spine */}
            <nav
              aria-label="Primary navigation"
              className="tw:w-16 tw:shrink-0 tw:bg-surface-base tw:border-r tw:border-stroke-neutral-translucent-weak tw:flex tw:flex-col"
            ></nav>
            {/* sidebar */}
            <aside
              aria-label="Secondary navigation"
              className="tw:px-3 tw:py-6 md:tw:py-3 tw:lg:w-64 tw:md:w-15 tw:bg-surface-mid tw:shrink-0 tw:transition-all tw:duration-100 tw:ease-in-out tw:overflow-auto tw:md:overflow-clip"
            >
              {/* Navigation */}
              <div className="tw:flex-1 tw:overflow-y-auto tw:p-2">
                {PAGE_GROUPS.map(renderPageGroup)}
              </div>
            </aside>

            {/* content */}
            <main
              role="main"
              className="tw:flex tw:flex-1 tw:h-full tw:bg-surface-low tw:overflow-auto"
            >
              {objects.map(renderPage)}
            </main>
          </div>
          {/* statusbar */}
          <footer
            role="contentinfo"
            className="tw:h-8 tw:shrink-0 tw:flex tw:items-center tw:px-4 tw:gap-4 tw:border-t tw:border-stroke-neutral-translucent-weak tw:bg-surface-base">
            <div className="tw:flex tw:items-center tw:gap-2 tw:border-r tw:border-stroke-neutral-translucent-weak tw:pr-4">
              StatusBar
            </div>
          </footer>
        </div>

        {/* Menu layer for dropdowns */}
        <div ref={menuLayerRef} />

        {/* Dialog system */}
        <Dialog />
        <DialogContainer
          visibleDialog={visibleDialog}
          onHideDialog={hideDialog}
        />
        <OverlayContainer />
        <Toaster />
      </MainContext.Provider>
    </LegacyContextProvider>
  );
}

/**
 * MainWindowNext - Entry point that wraps the functional component
 */
function MainWindowNext(props: IMainWindowNextProps) {
  return <MainWindowNextContent {...props} />;
}

export default MainWindowNext;
