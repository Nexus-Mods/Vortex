import * as actions from '../src/extensions/category_management/actions/category';


describe('loadCategories', () => {
  it('creates the correct action', () => {
    let categories = {
      cat1: { name: 'cat1name', order: 0 },
      cat2: { name: 'cat2name', order: 2 },
      cat12: { name: 'cat12name', order: 1, parentCategory: 'cat1' },
    }
    let action = actions.loadCategories('test', categories);
    expect(action).toEqual({
      error: false, 
      type: 'LOAD_CATEGORIES',
      payload: { gameId: 'test', gameCategories: categories },
    });
  });
});

describe('renameCategory', () => {
  it('creates the correct action', () => {
    expect(actions.renameCategory('test', 'cat1', 'New Name')).toEqual({
      error: false,
      type: 'RENAME_CATEGORY',
      payload: { gameId: 'test', categoryId: 'cat1', name: 'New Name' },
    });
  });
});
