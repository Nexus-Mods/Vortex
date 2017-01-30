import { tableReducer } from '../src/reducers/tables';

describe('selectRows', () => {
  it('marks rows selected', () => {
    let input = { };
    let result = tableReducer.reducers.SELECT_ROWS(input,
      { tableId: 'test', rowIds: ['row1', 'row2'], selected: true });
    expect(result.test.rows).toEqual({ row1: { selected: true }, row2: { selected: true } });
  });
  it('removes unselected rows', () => {
    let input = { test: { rows: { row1: { selected: true }, row2: { selected: true } } } };
    let result = tableReducer.reducers.SELECT_ROWS(input,
      { tableId: 'test', rowIds: ['row1', 'row2'], selected: false });
    expect(result.test.rows).toEqual({ });
  });
  it('leaves other tables alone', () => {
    let input = { test1: { rows: { row1: { selected: true }, row2: { selected: true } } } };
    let result = tableReducer.reducers.SELECT_ROWS(input,
      { tableId: 'test2', rowIds: ['row1', 'row2'], selected: false });
    expect(result).toEqual(input);
  });
});

describe('setAttributeVisible', () => {
  it('marks attribute visible', () => {
    let input = {};
    let result = tableReducer.reducers.SET_ATTRIBUTE_VISIBLE(input,
      { tableId: 'test', attributeId: 'attr1', visible: true });
    expect(result).toEqual({ test: { attributes: { attr1: { enabled: true } } } });
  });
  it('marks attribute invisible', () => {
    let input = {};
    let result = tableReducer.reducers.SET_ATTRIBUTE_VISIBLE(input,
      { tableId: 'test', attributeId: 'attr1', visible: false });
    expect(result).toEqual({ test: { attributes: { attr1: { enabled: false } } } });
  });
});

describe('setAttributeSort', () => {
  it('set attribute sort direction', () => {
    let input = {};
    let result = tableReducer.reducers.SET_ATTRIBUTE_SORT(input,
      { tableId: 'test', attributeId: 'attr1', direction: 'asc' });
    expect(result).toEqual({ test: { attributes: { attr1: { sortDirection: 'asc' } } } });
  });
});
