'use strict';

const Struct = require('../ref-struct-macos');

describe('ref-struct-macos', () => {
  it('should create struct type', () => {
    const PersonStruct = new Struct({
      age: 'int32',
      name: 'string'
    });

    expect(PersonStruct).toBeInstanceOf(Function);
    expect(PersonStruct.size).toBeInstanceOf(Function);
    expect(PersonStruct.fields).toBeDefined();
  });

  it('should calculate struct size', () => {
    const PersonStruct = new Struct({
      age: 'int32', // 4 bytes
      active: 'bool' // 1 byte
    });

    // Note: This is a simplified calculation without padding
    expect(PersonStruct.size()).toBe(5);
  });

  it('should create struct instance', () => {
    const PersonStruct = new Struct({
      age: 'int32',
      active: 'bool'
    });

    const person = new PersonStruct();
    
    expect(person.age).toBeDefined();
    expect(person.active).toBeDefined();
  });
});