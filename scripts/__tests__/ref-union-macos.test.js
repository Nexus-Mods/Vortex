'use strict';

const Union = require('../ref-union-macos');

describe('ref-union-macos', () => {
  it('should create union type', () => {
    const DataUnion = new Union({
      intValue: 'int32',
      floatValue: 'float'
    });

    expect(DataUnion).toBeInstanceOf(Function);
    expect(DataUnion.size).toBeInstanceOf(Function);
    expect(DataUnion.fields).toBeDefined();
  });

  it('should calculate union size as largest field', () => {
    const DataUnion = new Union({
      intValue: 'int32', // 4 bytes
      floatValue: 'float', // 4 bytes
      doubleValue: 'double' // 8 bytes
    });

    expect(DataUnion.size()).toBe(8); // Size of largest field (double)
  });

  it('should create union instance', () => {
    const DataUnion = new Union({
      intValue: 'int32',
      floatValue: 'float'
    });

    const data = new DataUnion();
    
    expect(data.intValue).toBeDefined();
    expect(data.floatValue).toBeDefined();
    // In a union, all fields should point to the same memory
    expect(data.intValue).toBe(data.floatValue);
  });
});