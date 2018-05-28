import { tableReducer } from '../src/reducers/tables';

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
