/* eslint-env jest */
import OAuth from '../src/extensions/nexus_integration/util/oauth';

describe('OAuth constructor regression tests', () => {
  it('does not emit deprecation warnings when processing placeholder redirect URL', () => {
    const warnings = [];
    const originalEmit = process.emit;
    
    // Capture deprecation warnings 
    process.emit = function(event, warning) {
      if (event === 'warning' && warning.name === 'DeprecationWarning' && warning.message.includes('Invalid URL')) {
        warnings.push(warning.message);
      }
      return originalEmit.apply(process, arguments);
    };

    try {
      // This should not trigger "Invalid URL" deprecation warning
      new OAuth({
        baseUrl: 'https://example.com',
        clientId: 'test-client',
        redirectUrl: 'http://127.0.0.1:PORT'
      });
      
      expect(warnings).toHaveLength(0);
    } finally {
      process.emit = originalEmit;
    }
  });

  it('correctly identifies localhost redirect URLs', () => {
    const oauth = new OAuth({
      baseUrl: 'https://example.com',
      clientId: 'test-client',
      redirectUrl: 'http://127.0.0.1:PORT'
    });
    
    // Access private property through reflection to verify the fix
    expect(oauth['mLocalhost']).toBe(true);
  });
});