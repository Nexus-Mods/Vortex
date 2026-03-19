import * as actions from '../actions/session';

describe('displayGroup', () => {
  it('generates an action', () => {
    expect(actions.displayGroup('groupId', 'itemId')).toEqual({
      error: false,
      type: 'DISPLAY_GROUP',
      payload: { groupId: 'groupId', itemId: 'itemId' }
    });
  });
});

