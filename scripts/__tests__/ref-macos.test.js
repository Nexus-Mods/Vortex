'use strict';

const ref = require('../ref-macos');

describe('ref-macos', () => {
  describe('types', () => {
    it('should have basic types defined', () => {
      expect(ref.types).toBeDefined();
      expect(ref.types.int32).toBeDefined();
      expect(ref.types.int32.size).toBe(4);
      expect(ref.types.pointer.size).toBe(8); // 64-bit pointer on macOS
    });
  });

  describe('refType', () => {
    it('should create reference type', () => {
      const intType = ref.types.int32;
      const refType = ref.refType(intType);
      
      expect(refType).toBeDefined();
      expect(refType.size).toBe(8); // Pointer size
      expect(refType.indirection).toBe(2); // One level of indirection added
    });
  });

  describe('coerceType', () => {
    it('should coerce string type to type object', () => {
      const type = ref.coerceType('int32');
      expect(type).toBe(ref.types.int32);
    });

    it('should return type object as-is', () => {
      const type = ref.coerceType(ref.types.int32);
      expect(type).toBe(ref.types.int32);
    });
  });

  describe('alloc', () => {
    it('should allocate memory for type', () => {
      const buffer = ref.alloc(ref.types.int32);
      
      expect(buffer).toBeDefined();
      expect(buffer.size).toBe(4);
      expect(buffer.type).toBe(ref.types.int32);
      expect(buffer.address).toBeDefined();
    });
  });
});