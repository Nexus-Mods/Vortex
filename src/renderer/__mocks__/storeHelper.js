/**
 * Mock for storeHelper utility functions used in tests
 */

// Import actual utility functions from the real storeHelper for proper behavior
let actualStoreHelper;
try {
  actualStoreHelper = jest.requireActual('../util/storeHelper');
} catch (error) {
  // If we can't load the actual module due to circular dependencies, 
  // provide basic fallback implementations
  actualStoreHelper = null;
}

// If we have the actual module, use it; otherwise provide basic implementations
if (actualStoreHelper) {
  module.exports = {
    getSafe: actualStoreHelper.getSafe,
    setSafe: actualStoreHelper.setSafe,
    deleteOrNop: actualStoreHelper.deleteOrNop,
    merge: actualStoreHelper.merge,
    removeValue: actualStoreHelper.removeValue,
    pushSafe: actualStoreHelper.pushSafe,
    setOrNop: actualStoreHelper.setOrNop,
    updateOrNop: actualStoreHelper.updateOrNop,
  };
} else {
  // Basic fallback implementations for testing
  function getSafe(obj, path, fallback) {
    let current = obj;
    for (const key of path) {
      if (current == null || current[key] === undefined) {
        return fallback;
      }
      current = current[key];
    }
    return current;
  }

  function setSafe(obj, path, value) {
    const result = JSON.parse(JSON.stringify(obj || {}));
    let current = result;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[path[path.length - 1]] = value;
    return result;
  }

  function deleteOrNop(obj, path) {
    if (!obj) return obj;
    
    const result = JSON.parse(JSON.stringify(obj));
    let current = result;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined) {
        return result;
      }
      current = current[key];
    }
    
    const lastKey = path[path.length - 1];
    if (current && current.hasOwnProperty(lastKey)) {
      delete current[lastKey];
    }
    
    return result;
  }

  function merge(obj, path, value) {
    const result = JSON.parse(JSON.stringify(obj || {}));
    let current = result;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const lastKey = path[path.length - 1];
    if (current[lastKey] === undefined) {
      current[lastKey] = {};
    }
    
    current[lastKey] = { ...current[lastKey], ...value };
    return result;
  }

  function removeValue(obj, path, value) {
    const result = JSON.parse(JSON.stringify(obj || {}));
    let current = result;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined) {
        return result;
      }
      current = current[key];
    }
    
    const lastKey = path[path.length - 1];
    if (Array.isArray(current[lastKey])) {
      current[lastKey] = current[lastKey].filter(item => item !== value);
    }
    
    return result;
  }

  function pushSafe(obj, path, value) {
    const result = JSON.parse(JSON.stringify(obj || {}));
    let current = result;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const lastKey = path[path.length - 1];
    if (!Array.isArray(current[lastKey])) {
      current[lastKey] = [];
    }
    
    current[lastKey].push(value);
    return result;
  }

  function setOrNop(obj, path, value) {
    return setSafe(obj, path, value);
  }

  function updateOrNop(obj, path, updater) {
    const currentValue = getSafe(obj, path, undefined);
    if (currentValue !== undefined) {
      return setSafe(obj, path, updater(currentValue));
    }
    return obj;
  }

  module.exports = {
    getSafe,
    setSafe,
    deleteOrNop,
    merge,
    removeValue,
    pushSafe,
    setOrNop,
    updateOrNop,
  };
}
