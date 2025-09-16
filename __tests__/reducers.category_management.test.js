import { categoryReducer } from '../src/extensions/category_management/reducers/category';

describe('loadCategories', () => {
  it('replaces existing categories', () => {
    const input = { game1: { cat1old: { name: 'Cat1 name', order: 0 } } };
    const categories = {
      cat1new: { name: 'Cat1 name', order: 0 },
      cat2new: { name: 'Cat2 name', order: 2 },
      cat12new: { name: 'Cat12 name', order: 1, parentCategory: 'cat1new' },
    };
    const result = categoryReducer.reducers.LOAD_CATEGORIES(input, { gameId: 'game1', gameCategories: categories });
    expect(result).toEqual({ game1: categories });
  });

  it('leaves other games alone', () => {
    const input = { game1: { cat1: { name: 'Cat1 name', order: 0 } } };
    const categories = {
      cat1: { name: 'Cat1 name game2', order: 0 },
    };
    const result = categoryReducer.reducers.LOAD_CATEGORIES(input, { gameId: 'game2', gameCategories: categories });
    expect(result).toEqual(Object.assign(input, { game2: categories }));
  });
});

describe('renameCategory', () => {
  it('renames the category', () => {
    const input = { game1: { cat1: { name: 'Old name' } } };
    const result = categoryReducer.reducers.RENAME_CATEGORY(input, { gameId: 'game1', categoryId: 'cat1', name: 'New name' });
    expect(result).toEqual({ game1: { cat1: { name: 'New name' } } });
  });
  it('does nothing if the category doesn\'t exist', () => {
    const input = { game1: { cat1: { name: 'Old name' } } };
    const result = categoryReducer.reducers.RENAME_CATEGORY(input, { gameId: 'game1', categoryId: 'cat2', name: 'New name' });
    expect(result).toEqual({ game1: { cat1: { name: 'Old name' } } });
  });
  it('affects only the right game', () => {
    const input = { game1: { cat1: { name: 'Old name' } }, game2: { cat1: { name: 'Old name' } } };
    const result = categoryReducer.reducers.RENAME_CATEGORY(input, { gameId: 'game1', categoryId: 'cat1', name: 'New name' });
    expect(result).toEqual({ game1: { cat1: { name: 'New name' } }, game2: { cat1: { name: 'Old name' } } });
  });
});
