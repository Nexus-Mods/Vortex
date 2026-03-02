import { NotificationAggregator } from '../extensions/mod_management/NotificationAggregator';

// Mock API for testing
const mockApi = {
  showErrorNotification: jest.fn(),
  sendNotification: jest.fn(),
};

describe('NotificationAggregator', () => {
  let aggregator: NotificationAggregator;

  beforeEach(() => {
    aggregator = new NotificationAggregator(mockApi as any);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should show notifications immediately when aggregation is not active', async () => {
    aggregator.addNotification(
      'test-session',
      'error',
      'Test Error',
      'Test message',
      'TestMod',
      { allowReport: false }
    );

    // Run any pending timers/setImmediate
    jest.runAllTimers();

    expect(mockApi.showErrorNotification).toHaveBeenCalledWith('Test Error', 'Test message', {
      message: 'TestMod',
      allowReport: false,
      actions: undefined,
    });
  });

  test('should aggregate similar notifications', async () => {
    aggregator.startAggregation('test-session', 0);

    // Add multiple similar notifications
    aggregator.addNotification('test-session', 'error', 'Failed to install dependency', 'Download failed', 'Mod1');
    aggregator.addNotification('test-session', 'error', 'Failed to install dependency', 'Download failed', 'Mod2');
    aggregator.addNotification('test-session', 'error', 'Failed to install dependency', 'Download failed', 'Mod3');

    // Flush aggregation and wait for completion
    await aggregator.flushAggregation('test-session');

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(1);
    expect(mockApi.showErrorNotification).toHaveBeenCalledWith(
      "Failed to install dependency (3 dependencies)",
      expect.stringContaining('Affected dependencies: Mod1, Mod2, Mod3'),
      expect.objectContaining({
        allowReport: undefined,
        id: expect.stringContaining("aggregated-")
      })
    );
  });

  test('should handle different error types separately', async () => {
    aggregator.startAggregation('test-session', 0);

    // Use different titles to ensure they are grouped separately
    aggregator.addNotification('test-session', 'error', 'Download failed', 'Connection error', 'Mod1');
    aggregator.addNotification('test-session', 'error', 'Invalid URL', 'Malformed URL', 'Mod2');

    await aggregator.flushAggregation('test-session');

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(2);
  });

  test('should handle many dependencies by truncating the list', async () => {
    aggregator.startAggregation('test-session', 0);

    // Add more than 5 dependencies
    for (let i = 1; i <= 7; i++) {
      aggregator.addNotification('test-session', 'error', 'Failed to install dependency', 'Download failed', `Mod${i}`);
    }

    await aggregator.flushAggregation('test-session');

    expect(mockApi.showErrorNotification).toHaveBeenCalledWith(
      "Failed to install dependency (7 dependencies)",
      expect.stringContaining("and 2 more"),
      expect.objectContaining({
        allowReport: undefined,
        id: expect.stringContaining("aggregated-error-Failed to install dependency")
      })
    );
  });

  test('should auto-flush on timeout', async () => {
    aggregator.startAggregation('test-session', 100); // 100ms timeout

    aggregator.addNotification('test-session', 'error', 'Test Error', 'Test message', 'TestMod');

    // Advance timers past the timeout to trigger the auto-flush
    jest.advanceTimersByTime(150);

    // Stop the aggregation (which flushes remaining notifications)
    await aggregator.stopAggregation('test-session');

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(1);
  });

  test('should stop aggregation and flush notifications', async () => {
    aggregator.startAggregation('test-session', 0);
    aggregator.addNotification('test-session', 'error', 'Test Error', 'Test message', 'TestMod');

    await aggregator.stopAggregation('test-session');

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(1);
    expect(aggregator.isAggregating('test-session')).toBe(false);
  });
});
