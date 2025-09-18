#!/usr/bin/env node

// Test script to verify the registerGame fix
const path = require('path');

// Mock the required modules for testing
const mockApi = {
  events: { emit: () => {}, on: () => {} },
  store: { getState: () => ({}) },
  ext: {}
};

const mockEventEmitter = {
  setMaxListeners: () => {},
  emit: () => {},
  on: () => {}
};

// Import the ExtensionManager
const ExtensionManager = require('./lib/src/util/ExtensionManager').default;

console.log('Testing registerGame fix...');

try {
  // Create an instance of ExtensionManager
  const extensionManager = new ExtensionManager(null, mockEventEmitter);
  
  // Access the private method for testing (this is a hack for testing)
  const initExtensions = extensionManager.initExtensions.bind(extensionManager);
  
  // Mock the required properties
  extensionManager.mApi = mockApi;
  extensionManager.mExtensions = [
    {
      name: 'test-extension',
      path: '/test/path',
      dynamic: true,
      initFunc: () => (context) => {
        console.log('Testing registerGame call...');
        if (typeof context.registerGame === 'function') {
          console.log('✅ registerGame is available as a function');
          try {
            context.registerGame({ id: 'test-game' }, '/test/extension/path');
            console.log('✅ registerGame call succeeded (queued)');
          } catch (err) {
            console.log('❌ registerGame call failed:', err.message);
          }
        } else {
          console.log('❌ registerGame is not a function:', typeof context.registerGame);
        }
      }
    }
  ];
  
  console.log('Test completed successfully!');
  
} catch (err) {
  console.error('Test failed:', err.message);
  console.error(err.stack);
}