'use strict';

/**
 * macOS-native implementation of ref-union module
 * Provides union data type capabilities
 */

const ref = require('./ref-macos');

/**
 * Create a union type
 * @param {Object} fields - Object describing the fields of the union
 * @returns {Function} Constructor function for the union type
 */
function createUnion(fields) {
  // Create a constructor function for this union type
  function Union() {
    // In a union, all fields share the same memory location
    // We'll allocate memory for the largest field
    let maxSize = 0;
    let largestField = null;
    
    for (const [fieldName, fieldType] of Object.entries(fields)) {
      const resolvedType = ref.coerceType(fieldType);
      if (resolvedType.size > maxSize) {
        maxSize = resolvedType.size;
        largestField = fieldName;
      }
    }
    
    // Allocate memory for the largest field
    if (largestField) {
      const resolvedType = ref.coerceType(fields[largestField]);
      this._buffer = ref.alloc(resolvedType);
      
      // All fields point to the same buffer
      for (const fieldName of Object.keys(fields)) {
        this[fieldName] = this._buffer;
      }
    }
  }
  
  // Add a method to get the size of the union
  Union.size = () => {
    let maxSize = 0;
    for (const fieldType of Object.values(fields)) {
      const resolvedType = ref.coerceType(fieldType);
      if (resolvedType.size > maxSize) {
        maxSize = resolvedType.size;
      }
    }
    return maxSize;
  };
  
  // Add a method to get the fields definition
  Union.fields = fields;
  
  return Union;
}

// Export to match ref-union API
module.exports = createUnion;