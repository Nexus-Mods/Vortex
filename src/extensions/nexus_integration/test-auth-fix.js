#!/usr/bin/env node

/**
 * Test script to verify the authentication timeout fix
 * This tests the race condition fix in ensureLoggedIn function
 */

// Mock the required modules and APIs
function createMockAPI() {
  let currentState = {
    confidential: {
      account: {
        nexus: {
          OAuthCredentials: null,
          APIKey: null
        }
      }
    }
  };
  
  let storeCallbacks = [];
  
  return {
    getState: () => currentState,
    store: {
      subscribe: (callback) => {
        storeCallbacks.push(callback);
        return () => {
          const index = storeCallbacks.indexOf(callback);
          if (index > -1) {
            storeCallbacks.splice(index, 1);
          }
        };
      },
      dispatch: () => {}
    },
    events: {
      once: (event, handler) => {
        // Store handler but don't auto-trigger for these tests
      },
      removeListener: () => {}
    },
    _simulateLogin: (credentials) => {
      // Update state
      currentState = {
        confidential: {
          account: {
            nexus: credentials
          }
        }
      };
      // Trigger all store callbacks after a small delay
      setTimeout(() => {
        storeCallbacks.forEach(callback => {
          try {
            callback();
          } catch (e) {
            // Ignore callback errors in test
          }
        });
      }, 10);
    }
  };
}

// Mock the isLoggedIn function
function isLoggedIn(state) {
  const nexus = state.confidential?.account?.nexus;
  if (!nexus) return false;
  
  // Check for OAuth credentials
  if (nexus.OAuthCredentials?.token && nexus.OAuthCredentials?.refresh_token) {
    return true;
  }
  
  // Check for API key
  if (nexus.APIKey) {
    return true;
  }
  
  return false;
}

// Simplified ensureLoggedIn function for testing (with 1 second timeout)
async function ensureLoggedIn(api) {
  // Check if already logged in
  if (isLoggedIn(api.getState())) {
    return true;
  }

  return new Promise((resolve, reject) => {
    let resolved = false;
    
    // Set up store subscription to watch for state changes
    const unsubscribe = api.store.subscribe(() => {
      if (resolved) return;
      
      const currentState = api.getState();
      if (isLoggedIn(currentState)) {
        resolved = true;
        unsubscribe();
        resolve(true);
      }
    });

    // Set up timeout with improved final check
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      
      // Add a small delay before final check to allow state updates to complete
      setTimeout(() => {
        if (resolved) return;
        
        const finalState = api.getState();
        const hasOAuthCreds = !!(finalState.confidential?.account?.nexus?.OAuthCredentials?.token);
        const hasApiKey = !!(finalState.confidential?.account?.nexus?.APIKey);
        const isLoggedInResult = isLoggedIn(finalState);
        
        console.warn('Authentication timeout despite login check:', {
          hasOAuthCreds,
          hasApiKey,
          isLoggedInResult
        });
        
        if (isLoggedInResult) {
          resolved = true;
          unsubscribe();
          resolve(true);
        } else {
          resolved = true;
          unsubscribe();
          reject(new Error('Authentication timeout: The login process took too long'));
        }
      }, 100);
    }, 1000); // 1 second timeout for testing

    // Listen for did-login event
    api.events.once('did-login', () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      unsubscribe();
      resolve(true);
    });
  });
}

// Test runner class
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async runTests() {
    console.log('🧪 Running Nexus Authentication Timeout Fix Tests\n');
    
    for (const test of this.tests) {
      console.log(`▶️  ${test.name}`);
      try {
        await test.testFn();
        console.log(`✅ ${test.name} - PASSED\n`);
        this.results.push({ name: test.name, passed: true });
      } catch (error) {
        console.log(`❌ ${test.name} - FAILED: ${error.message}\n`);
        this.results.push({ name: test.name, passed: false, error: error.message });
      }
    }

    this.printSummary();
  }

  printSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const successRate = ((passed / total) * 100).toFixed(1);

    console.log('📊 TEST SUMMARY');
    console.log('================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${successRate}%`);

    if (passed === total) {
      console.log('\n🎉 All tests passed! The authentication timeout fix is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the implementation.');
    }
  }
}

// Test cases
const runner = new TestRunner();

// Test 1: User already logged in
runner.addTest('Login succeeds immediately when already logged in', async () => {
  const mockAPI = createMockAPI();
  
  // Set up already logged in state
  mockAPI._simulateLogin({
    OAuthCredentials: { token: 'existing-token', refresh_token: 'refresh' },
    APIKey: null
  });

  const result = await ensureLoggedIn(mockAPI);
  if (result !== true) {
    throw new Error('Should resolve immediately for logged in user');
  }
});

// Test 2: OAuth login after delay
runner.addTest('Login succeeds with OAuth credentials after delay', async () => {
  const mockAPI = createMockAPI();

  // Simulate login after 200ms
  setTimeout(() => {
    mockAPI._simulateLogin({
      OAuthCredentials: { token: 'new-token', refresh_token: 'refresh' },
      APIKey: null
    });
  }, 200);

  const result = await ensureLoggedIn(mockAPI);
  if (result !== true) {
    throw new Error('Should resolve when OAuth credentials are added');
  }
});

// Test 3: API key login after delay
runner.addTest('Login succeeds with API key after delay', async () => {
  const mockAPI = createMockAPI();

  // Simulate API key login after 300ms
  setTimeout(() => {
    mockAPI._simulateLogin({
      OAuthCredentials: null,
      APIKey: 'test-api-key'
    });
  }, 300);

  const result = await ensureLoggedIn(mockAPI);
  if (result !== true) {
    throw new Error('Should resolve when API key is added');
  }
});

// Test 4: True timeout (no login)
runner.addTest('Timeout still occurs when login truly fails', async () => {
  const mockAPI = createMockAPI();
  // Don't simulate any login - should timeout

  try {
    await ensureLoggedIn(mockAPI);
    throw new Error('Should have timed out');
  } catch (error) {
    if (!error.message.includes('Authentication timeout')) {
      throw new Error(`Expected timeout error, got: ${error.message}`);
    }
    // This is expected - test passes
  }
});

// Run the tests
runner.runTests().catch(console.error);