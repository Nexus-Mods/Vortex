'use strict';

/**
 * macOS-native implementation of ref-struct module
 * Provides structured data type capabilities
 */

const ref = require('./ref-macos');

/**
 * Create a struct type
 * @param {Object} fields - Object describing the fields of the struct
 * @returns {Function} Constructor function for the struct type
 */
function createStruct(fields) {
  // Create a constructor function for this struct type
  function Struct() {
    // Initialize fields with default values
    for (const [fieldName, fieldType] of Object.entries(fields)) {
      const resolvedType = ref.coerceType(fieldType);
      this[fieldName] = ref.alloc(resolvedType);
    }
  }
  
  // Add a method to get the size of the struct
  Struct.size = () => {
    let totalSize = 0;
    for (const fieldType of Object.values(fields)) {
      const resolvedType = ref.coerceType(fieldType);
      totalSize += resolvedType.size || 0;
    }
    return totalSize;
  };
  
  // Add a method to get the fields definition
  Struct.fields = fields;
  
  return Struct;
}

// Export to match ref-struct API
module.exports = createStruct;