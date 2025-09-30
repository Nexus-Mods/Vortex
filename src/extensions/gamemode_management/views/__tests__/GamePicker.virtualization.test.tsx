import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import GamePicker from '../GamePicker';
import { IGameStored } from '../../types/IGameStored';
import { IDiscoveryResult } from '../../types/IDiscoveryResult';
import { IProfile } from '../../../profile_management/types/IProfile';
import { IAvailableExtension, IExtension } from '../../../extension_manager/types';
import { IGameListEntry } from '@nexusmods/nexus-api';
import Promise from 'bluebird';

// Mock the translation function
const mockT = (input: string) => input;

// Create a proper mock Redux store with all required state
const createMockStore = () => {
  const state = {
    settings: {
      gameMode: {
        discovered: {},
        pickerLayout: 'list',
        sortManaged: 'alphabetical',
        sortUnmanaged: 'alphabetical',
      },
      automation: {},
      interface: {},
      window: {},
      tables: {},
      notifications: {},
      providers: {},
      profiles: {},
    },
    persistent: {
      profiles: {},
      mods: {},
      categories: {},
      loadOrder: {},
      deployment: {},
      notifications: {},
      history: {},
    },
    session: {
      base: {
        mainPage: 'game',
        secondaryPage: '',
        overlayOpen: false,
        visibleDialog: '',
        activity: {},
        progress: {},
        settingsPage: '',
        extLoadFailures: {},
        toolsRunning: {},
        uiBlockers: {},
        networkConnected: true,
        commandLine: {},
      },
      gameMode: {
        known: [],
      },
      extensions: {
        available: [],
        installed: {},
      },
      downloads: {
        files: {},
        speed: 0,
        speedHistory: [],
      },
    },
    app: {
      instanceId: 'test',
      version: '1.0.0',
      appVersion: '1.0.0',
      extensions: {},
      warnedAdmin: 0,
      installType: 'regular',
      migrations: [],
    },
    user: {
      multiUser: false,
    },
    conf: {
      user: {},
      machine: {},
    },
    confidential: {
      account: {},
      machineId: '',
    },
  };

  return {
    getState: () => state,
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    replaceReducer: jest.fn(),
    [Symbol.observable]: () => this,
  };
};

// Mock the context
const mockContext = {
  api: {
    events: {
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
    },
    store: {
      getState: jest.fn(),
      dispatch: jest.fn(),
    },
    showErrorNotification: jest.fn(),
    sendNotification: jest.fn(),
    dismissNotification: jest.fn(),
    showOverlay: jest.fn(),
    hideOverlay: jest.fn(),
    showDialog: jest.fn(),
    closeDialog: jest.fn(),
    showDropdown: jest.fn(),
    showContextMenu: jest.fn(),
    selectFile: jest.fn(),
    selectExecutable: jest.fn(),
    selectDir: jest.fn(),
    open: jest.fn(),
    onStateChange: jest.fn(),
    onAsync: jest.fn(),
    onMain: jest.fn(),
    emitAndAwait: jest.fn(),
    await: jest.fn(),
    withContext: jest.fn(),
    showURL: jest.fn(),
    getI18n: jest.fn(),
    getTFunction: jest.fn(),
    getTString: jest.fn(),
    getTPromise: jest.fn(),
    getTPrepared: jest.fn(),
    extend: jest.fn(),
    registerAction: jest.fn(),
    deregisterAction: jest.fn(),
    registerDialog: jest.fn(),
    deregisterDialog: jest.fn(),
    registerSettings: jest.fn(),
    deregisterSettings: jest.fn(),
    registerMainPage: jest.fn(),
    deregisterMainPage: jest.fn(),
    registerDashlet: jest.fn(),
    deregisterDashlet: jest.fn(),
    registerFooter: jest.fn(),
    deregisterFooter: jest.fn(),
    registerBanner: jest.fn(),
    deregisterBanner: jest.fn(),
    registerOverlay: jest.fn(),
    deregisterOverlay: jest.fn(),
    registerReducer: jest.fn(),
    registerSaga: jest.fn(),
    registerProtocol: jest.fn(),
    deregisterProtocol: jest.fn(),
    registerGame: jest.fn(),
    deregisterGame: jest.fn(),
    registerGameStub: jest.fn(),
    deregisterGameStub: jest.fn(),
    registerInstaller: jest.fn(),
    deregisterInstaller: jest.fn(),
    registerModType: jest.fn(),
    deregisterModType: jest.fn(),
    registerTest: jest.fn(),
    deregisterTest: jest.fn(),
    registerAttributeExtractor: jest.fn(),
    deregisterAttributeExtractor: jest.fn(),
    registerAttributeIcon: jest.fn(),
    deregisterAttributeIcon: jest.fn(),
    registerAttributeFormatter: jest.fn(),
    deregisterAttributeFormatter: jest.fn(),
    registerDownloadAttribute: jest.fn(),
    deregisterDownloadAttribute: jest.fn(),
    registerDeploymentMethod: jest.fn(),
    deregisterDeploymentMethod: jest.fn(),
    registerToDo: jest.fn(),
    deregisterToDo: jest.fn(),
    registerProfileFile: jest.fn(),
    deregisterProfileFile: jest.fn(),
    registerAttributePreview: jest.fn(),
    deregisterAttributePreview: jest.fn(),
    registerGameVersionProvider: jest.fn(),
    deregisterGameVersionProvider: jest.fn(),
    registerGameVersionProviderTest: jest.fn(),
    deregisterGameVersionProviderTest: jest.fn(),
    registerGameVersionProviderGet: jest.fn(),
    deregisterGameVersionProviderGet: jest.fn(),
    registerGameVersionProviderOptions: jest.fn(),
    deregisterGameVersionProviderOptions: jest.fn(),
    registerGameVersionProviderExtPath: jest.fn(),
    deregisterGameVersionProviderExtPath: jest.fn(),
    registerGameVersionProviderPriority: jest.fn(),
    deregisterGameVersionProviderPriority: jest.fn(),
    registerGameVersionProviderSupported: jest.fn(),
    deregisterGameVersionProviderSupported: jest.fn(),
    registerGameVersionProviderGetGameVersion: jest.fn(),
    deregisterGameVersionProviderGetGameVersion: jest.fn(),
  },
  menuLayer: document.createElement('div'),
  getModifiers: () => ({}),
  headerPortal: () => document.createElement('div'),
  page: 'game',
};

// Mock props for GamePicker
const mockProps = {
  t: mockT,
  onRefreshGameInfo: jest.fn(() => Promise.resolve()),
  onBrowseGameLocation: jest.fn(() => Promise.resolve()),
  nexusGames: [] as IGameListEntry[],
  discoveredGames: {} as { [id: string]: IDiscoveryResult },
  profiles: {} as { [profileId: string]: IProfile },
  knownGames: [] as IGameStored[],
  gameMode: '',
  pickerLayout: 'list' as 'list' | 'small' | 'large',
  extensions: [] as IAvailableExtension[],
  extensionsInstalled: {} as { [extId: string]: IExtension },
  sortManaged: 'alphabetical',
  sortUnmanaged: 'alphabetical',
  onSetPickerLayout: jest.fn(),
  onSetSortManaged: jest.fn(),
  onSetSortUnmanaged: jest.fn(),
};

// Generate a large number of mock games for testing
const generateMockGames = (count: number): IGameStored[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `game-${i}`,
    name: `Game ${i}`,
    shortName: `G${i}`,
    executable: `game${i}.exe`,
    extensionPath: `/path/to/game-${i}`,
    logo: `logo-${i}.png`,
    requiredFiles: [],
    supportedTools: [],
    details: {
      nexusPageId: i,
      steamAppId: i,
    },
  }));
};

describe('GamePicker Virtualization', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  it('should render virtualized list for large game collections', () => {
    // Generate 1000 mock games to test virtualization
    const largeGameCollection = generateMockGames(1000);
    
    const props = {
      ...mockProps,
      knownGames: largeGameCollection,
    };

    const mockStore = createMockStore();

    act(() => {
      ReactDOM.render(
        <Provider store={mockStore}>
          <GamePicker {...props} />
        </Provider>,
        container
      );
    });

    // Check that the component rendered without crashing
    expect(container.querySelector('.gamepicker-body')).not.toBeNull();
    
    // Check that virtualized list is used for large collections
    // The threshold in our implementation is 50 games, so with 1000 games
    // we should be using the virtualized list
    expect(container.querySelector('.ReactVirtualized__List')).not.toBeNull();
  });

  it('should render standard list for small game collections', () => {
    // Generate 10 mock games to test standard rendering
    const smallGameCollection = generateMockGames(10);
    
    const props = {
      ...mockProps,
      knownGames: smallGameCollection,
    };

    const mockStore = createMockStore();

    act(() => {
      ReactDOM.render(
        <Provider store={mockStore}>
          <GamePicker {...props} />
        </Provider>,
        container
      );
    });

    // Check that the component rendered without crashing
    expect(container.querySelector('.gamepicker-body')).not.toBeNull();
    
    // Check that standard list is used for small collections
    // With only 10 games, we should be using the standard ListGroup
    expect(container.querySelector('.list-group')).not.toBeNull();
  });

  it('should maintain performance with large game collections', () => {
    // Generate 5000 mock games to test performance
    const veryLargeGameCollection = generateMockGames(5000);
    
    const props = {
      ...mockProps,
      knownGames: veryLargeGameCollection,
    };

    const mockStore = createMockStore();

    // Measure render time
    const start = performance.now();
    
    act(() => {
      ReactDOM.render(
        <Provider store={mockStore}>
          <GamePicker {...props} />
        </Provider>,
        container
      );
    });

    const end = performance.now();
    const renderTime = end - start;
    
    // Check that the component rendered without crashing
    expect(container.querySelector('.gamepicker-body')).not.toBeNull();
    
    // Verify virtualized list is used
    expect(container.querySelector('.ReactVirtualized__List')).not.toBeNull();
    
    // Performance check - rendering 5000 games should take less than 100ms
    // This is a rough check to ensure virtualization is working
    expect(renderTime).toBeLessThan(100);
  });
});