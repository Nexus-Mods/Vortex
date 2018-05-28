import * as actions from '../src/actions/index';

import safeCreateAction from '../src/actions/safeCreateAction';

describe('safeCreateAction', () => {
  it('creates the action creator', () => {
    let creator = safeCreateAction('ACTION');
    expect(typeof creator).toBe('function');
  });
  it('replaces action creator', () => {
    let c1 = safeCreateAction('ACTION', () => ({ key: 'old' }));
    expect(c1()).toEqual({ error: false, type: 'ACTION', payload: { key: 'old' } });
    let c2 = safeCreateAction('ACTION', () => ({ key: 'new' }));
    expect(c2()).toEqual({ error: false, type: 'ACTION', payload: { key: 'new' } });
  });
});

describe('addNotification', () => {
  it('creates the correct action for minimal case', () => {
    let minimal = {
      message: 'sample',
      type: 'info',
    };

    let expected = {
      type: 'ADD_NOTIFICATION',
      payload: minimal,
      error: false,
    };

    expect(actions.startNotification(minimal)).toEqual(expected);
  });

  it('creates the correct action if everything specified', () => {
    let complete = {
      id: '__test',
      message: 'sample',
      displayMS: 42,
      type: 'info',
      actions: [
        { title: 'test', action: () => undefined },
      ]
    };

    expect(actions.startNotification(complete)).toEqual({
      error: false,
      type: 'ADD_NOTIFICATION',
      payload: complete
    });
  });
});

describe('dismissNotification', () => {
  it('creates the correct action', () => {
    expect(actions.stopNotification('__test')).toEqual({
      error: false,
      type: 'STOP_NOTIFICATION',
      payload: '__test'
    });
  });
});

describe('setWindowSize', () => {
  it('creates the correct action', () => {
    let size = { width: 42, height: 13 };
    expect(actions.setWindowSize(size)).toEqual({
      error: false,
      type: 'STORE_WINDOW_SIZE',
      payload: size
    });
  });
});

describe('setWindowPosition', () => {
  it('creates the correct action', () => {
    let pos = { x: 1, y: 2 };
    expect(actions.setWindowPosition(pos)).toEqual({
      error: false,
      type: 'STORE_WINDOW_POSITION',
      payload: pos
    });
  });
});

describe('setMaximized', () => {
  it('creates the correct action', () => {
    expect(actions.setMaximized(true)).toEqual({
      error: false,
      type: 'SET_MAXIMIZED',
      payload: true
    });
  });
});

describe('setTabsMinimized', () => {
  it('creates the correct action', () => {
    expect(actions.setTabsMinimized(true)).toEqual({
      error: false,
      type: 'SET_TABS_MINIMIZED',
      payload: true
    });
  });
});
