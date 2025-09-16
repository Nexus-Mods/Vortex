import { windowReducer } from '../src/reducers/window';

describe('setWindowSize', () => {
  it('sets the size', () => {
    const input = {};
    const result = windowReducer.reducers.STORE_WINDOW_SIZE(input, { width: 1, height: 2 });
    expect(result.size).toEqual({ width: 1, height: 2 });
  });
});

describe('setWindowPosition', () => {
  it('sets the window position', () => {
    const input = {};
    const result = windowReducer.reducers.STORE_WINDOW_POSITION(input, { x: 1, y: 2 });
    expect(result.position).toEqual({ x: 1, y: 2 });
  });
});

describe('setMaximized', () => {
  it('sets the window maximized', () => {
    const input = {};
    const result = windowReducer.reducers.SET_MAXIMIZED(input, true);
    expect(result.maximized).toBe(true);
  });
});

describe('setTabsMinimized', () => {
  it('makes tabs minimized', () => {
    const input = {};
    const result = windowReducer.reducers.SET_TABS_MINIMIZED(input, true);
    expect(result.tabsMinimized).toBe(true);
  });
});
