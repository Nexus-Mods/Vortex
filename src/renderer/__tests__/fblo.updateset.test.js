import UpdateSet from "../extensions/file_based_loadorder/UpdateSet";
import {
  activeGameId,
  lastActiveProfileForGame,
} from "../extensions/profile_management/selectors";

const isFBLO = () => true;
const isNotFBLO = () => false;

const basicMockState = {
  persistent: {
    mods: {
      gameId: {
        mod1: {
          id: "mod1",
          name: "Test Mod",
          attributes: {
            modId: 1,
            fileId: 1,
          },
        },
        mod2: {
          id: "mod2",
          name: "Test Mod2",
          attributes: {
            modId: 2,
            fileId: 2,
          },
        },
        mod4: {
          id: "mod4",
          name: "Test Mod4",
          attributes: {
            modId: 4,
            fileId: 4,
          },
        },
      },
    },
    loadOrder: {
      profile1: [
        { id: "1", modId: "mod1", name: "Mod 1", enabled: true, index: 0 },
        { id: "2", modId: "mod2", name: "Mod 2", enabled: true, index: 1 },
        { id: "3", name: "Mod 3", enabled: true, index: 2 },
        { id: "4", name: "Mod 4", enabled: true, index: 3 },
        { id: "4-2", name: "Mod 4-2", enabled: true, index: 4 },
      ],
    },
  },
};

jest.mock("../extensions/profile_management/selectors", () => ({
  profileById: jest.fn(() => ({})), // TODO: mock this properly
  activeGameId: jest.fn(() => "gameId"),
  lastActiveProfileForGame: jest.fn(() => "profile1"),
}));

jest.mock("vortex-api", () => {
  const actualUtil = jest.requireActual("../util/api.ts");
  return {
    getState: jest.fn(),
    util: {
      ...actualUtil,
    },
    selectors: {
      activeGameId: jest.fn(() => "gameId"),
      lastActiveProfileForGame: jest.fn(() => "profile1"),
    },
  };
});

jest.mock("../controls/ComponentEx", () => {
  const React = require("react");
  return {
    ComponentEx: class {},
    translate: () => (Component) => {
      return (props) =>
        React.createElement(Component, { ...props, t: (key) => key });
    },
  };
});

jest.mock("react-i18next", () => {
  const React = require("react");
  return {
    withTranslation: () => (Component) => {
      return (props) =>
        React.createElement(Component, { ...props, t: (key) => key });
    },
  };
});

describe("UpdateSet", () => {
  let mockApi;

  beforeEach(() => {
    mockApi = {
      getState: jest.fn(),
    };
  });

  describe("Initialization", () => {
    it("should initialize correctly when FBLO is enabled", () => {
      const updateSet = new UpdateSet(mockApi, isFBLO);

      updateSet.init("gameId", []);
      expect(updateSet.isInitialized()).toBe(true);
    });

    it("should not initialize if FBLO is disabled", () => {
      const updateSet = new UpdateSet(mockApi, isNotFBLO);

      updateSet.init("gameId", []);
      expect(updateSet.isInitialized()).toBe(false);
    });
  });

  describe("State Management", () => {
    it("should reset state when forceReset is called", () => {
      const updateSet = new UpdateSet(mockApi, isFBLO);
      updateSet.init("gameId", []);
      updateSet.shouldRestore = true;
      updateSet.forceReset();

      expect(updateSet.isInitialized()).toBe(false);
      expect(updateSet.shouldRestore).toBe(false);
    });
  });

  describe("Adding Entries", () => {
    it("should add entries from state if init is called without mod entries", () => {
      mockApi.getState.mockReturnValue(basicMockState);

      const updateSet = new UpdateSet(mockApi, isFBLO);
      updateSet.init("gameId");

      expect(updateSet.has(1)).toBe(true);
    });
    it("should add managed load order entries", () => {
      mockApi.getState.mockReturnValue(basicMockState);

      const updateSet = new UpdateSet(mockApi, isFBLO);
      updateSet.init("gameId");
      const entry = {
        modId: "mod1",
        id: "1",
        name: "Test Mod",
        enabled: true,
        index: 0,
      };

      updateSet.addEntry(entry);

      expect(updateSet.has(1)).toBe(true);
    });
    it("should add unmanaged load order entries", () => {
      const updateSet = new UpdateSet(mockApi, isFBLO);
      updateSet.init("gameId", []);
      const entry = { id: "1", name: "Test Mod", enabled: true, index: 0 };

      updateSet.addEntry(entry);

      expect(updateSet.has("1")).toBe(true);
    });
  });

  describe("Restoring Load Order", () => {
    it("should restore load order correctly", () => {
      mockApi.getState.mockReturnValue(basicMockState);
      const updateSet = new UpdateSet(mockApi, isFBLO);
      const expected = [
        { id: "4-2", name: "Mod 4-2", enabled: true, index: 0 },
        { id: "3", name: "Mod 3", enabled: true, index: 1 },
        { id: "4", name: "Mod 4", enabled: true, index: 2 },
        {
          id: "2",
          fileId: 2,
          modId: "mod2",
          name: "Mod 2",
          enabled: true,
          index: 3,
        },
        {
          id: "1",
          fileId: 1,
          modId: "mod1",
          name: "Mod 1",
          enabled: true,
          index: 4,
        },
      ];
      updateSet.init("gameId", expected);

      const loadOrder = [
        { id: "1", modId: "mod1", name: "Mod 1", enabled: true, index: 0 },
        { id: "2", modId: "mod2", name: "Mod 2", enabled: true, index: 1 },
        { id: "3", name: "Mod 3", enabled: true, index: 2 },
        { id: "4", name: "Mod 4", enabled: true, index: 3 },
        { id: "4-2", name: "Mod 4-2", enabled: true, index: 4 },
      ];

      const restored = updateSet.restore(loadOrder);
      expect(restored).toEqual(expected);
    });

    it("should return the original load order if no entries are present", () => {
      const updateSet = new UpdateSet(mockApi, isFBLO);
      const loadOrder = [];

      const restored = updateSet.restore(loadOrder);

      expect(restored).toEqual([]);
    });
  });

  describe("Finding Entries", () => {
    it("should find an entry by modId", () => {
      const updateSet = new UpdateSet(mockApi, isFBLO);
      const entry = {
        modId: "mod1",
        id: "1",
        name: "Test Mod",
        enabled: true,
        index: 0,
      };

      updateSet.addEntry(entry);

      const found = updateSet.findEntry({
        modId: "mod1",
        id: "1",
        name: "Test Mod",
        enabled: true,
      });
      expect(found).not.toBeNull();
      expect(found?.entries[0].name).toBe("Test Mod");
    });

    it("should return null if entry is not found", () => {
      const updateSet = new UpdateSet(mockApi, isFBLO);

      const found = updateSet.findEntry({
        modId: "mod1",
        id: "1",
        name: "Test Mod",
        enabled: true,
      });
      expect(found).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined modId gracefully", () => {
      const updateSet = new UpdateSet(mockApi, isFBLO);
      const entry = { id: "1", name: "Test Mod", enabled: true, index: 0 };

      updateSet.addEntry(entry);

      expect(updateSet.has(1)).toBe(false);
    });

    it("should not add duplicate entries", () => {
      const state = {
        persistent: {
          mods: {
            gameId: {
              mod1: {
                id: "mod1",
                name: "Test Mod",
                attributes: {
                  modId: 1,
                },
              },
            },
          },
        },
      };
      mockApi.getState.mockReturnValue(state);
      const updateSet = new UpdateSet(mockApi, isFBLO);
      const entry = {
        modId: "mod1",
        id: "1",
        name: "Test Mod",
        enabled: true,
        index: 0,
      };

      updateSet.init("gameId", [entry]);
      updateSet.addEntry(entry);

      expect(updateSet.get(1)?.length).toBe(1);
    });
  });
});

