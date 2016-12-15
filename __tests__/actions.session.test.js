import * as actions from '../src/actions/session';

describe('displayGroup', () => {
  it('generates an action', () => {
    expect(actions.displayGroup('groupId', 'itemId')).toEqual({
      type: 'DISPLAY_GROUP',
      payload: { groupId: 'groupId', itemId: 'itemId' }
    });
  });
});

