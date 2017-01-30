import { sessionReducer } from '../src/reducers/session';

describe('displayGroup', () => {
  it('sets the display item and creates missing nodes', () => {
    let input = { };
    let result = sessionReducer.reducers.DISPLAY_GROUP(input, { groupId: 'someGroupId', itemId: 'someItemId' });
    expect(result.displayGroups).toEqual({ someGroupId: 'someItemId' });
  });
});
