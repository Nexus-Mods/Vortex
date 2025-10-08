/* eslint-env jest */
/* global jest, describe, test, expect */
/**
 * Tests for internal auto-resume and observer behavior on unfinished chunks.
 */
// NOTE: Jest globals declared above for linting in test environment.

jest.mock('../src/util/fs', () => ({
  statSync: jest.fn(() => ({ size: 123 })),
  removeAsync: jest.fn(() => Promise.resolve()),
  renameAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/util/selectors', () => ({
  downloadPathForGame: jest.fn(() => '/tmp/downloads'),
}));

jest.mock('../src/util/log', () => ({
  log: jest.fn(() => {}),
}));

const DownloadManager = require('../src/extensions/download_management/DownloadManager').default;
const observe = require('../src/extensions/download_management/DownloadObserver').default;

describe('Download internal resume', () => {
  test('finishChunk re-queues job when hasRemainingData without dispatching pause', () => {
    // Minimal running download shape
    const fakeAssembler = { close: jest.fn(() => Promise.resolve()) };
    const download = {
      id: 'dl1',
      tempName: '/tmp/downloads/dl1.tmp',
      finalName: undefined,
      headers: {},
      options: {},
      chunks: [],
      progressCB: jest.fn(),
      finishCB: jest.fn(),
      failedCB: jest.fn(),
      assembler: fakeAssembler,
      resolvedUrls: jest.fn(() => Promise.resolve({ urls: ['http://a'], meta: {} })),
      size: 1000,
      received: 500,
      chunkable: true,
      started: new Date(),
    };

    const manager = new DownloadManager(
      '/tmp/downloads',
      2,
      2,
      jest.fn(),
      'jest-agent',
      {},
      () => 0,
    );

    // Create a job with remaining data
    const job = {
      workerId: 1,
      url: () => Promise.resolve('http://a'),
      confirmedOffset: 0,
      confirmedSize: 100,
      confirmedReceived: 90,
      offset: 90,
      size: 10,
      received: 10,
      state: 'running',
      options: {},
      extraCookies: [],
      responseCB: jest.fn(),
      restartCount: 0,
    };
    download.chunks = [job];

    // Spy on private finishChunk via direct call
    manager.stopWorker = jest.fn();
    const finishChunk = Object.getPrototypeOf(manager).finishChunk.bind(manager);

    finishChunk(download, job, false);

    // Expect job set back to init (auto-resume path) and no finalization
    expect(job.state).toBe('init');
    expect(download.finishCB).not.toHaveBeenCalled();
    expect(download.failedCB).not.toHaveBeenCalled();
  });
});

describe('Observer resume on unfinishedChunks', () => {
  test('handleDownloadFinished resumes immediately and clears paused marker', async () => {
    // Minimal API stub
    const store = {
      getState: () => ({
        persistent: {
          downloads: {
            files: {
              dl2: {
                state: 'paused',
                localPath: 'file.tmp',
                urls: ['http://a'],
                received: 500,
                size: 1000,
                startTime: Date.now(),
                chunks: 1,
                modInfo: {},
              },
            },
          },
        },
        settings: { automation: { install: false } },
      }),
      dispatch: jest.fn(),
    };
    const api = {
      store,
      events: { emit: jest.fn() },
      getState: store.getState,
      sendNotification: jest.fn(),
    };

    // Manager stub to capture resume calls
    const manager = {
      resume: jest.fn(() => Promise.resolve({ filePath: '/tmp/downloads/file.tmp', unfinishedChunks: [], size: 1000, metaInfo: {} })),
    };

    const observer = observe(api, manager);

    const callback = jest.fn();
    const res = {
      filePath: '/tmp/downloads/file.tmp',
      headers: {},
      unfinishedChunks: [{ url: 'http://a', size: 100, offset: 900, received: 0 }],
      hadErrors: false,
      size: 1000,
      metaInfo: {},
    };

    await observer.handleDownloadFinished('dl2', callback, res, true);

    // Verify pause marker cleared and resume called with unfinished chunks
    expect(store.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: expect.stringMatching(/PAUSE_DOWNLOAD/i) }));
    expect(manager.resume).toHaveBeenCalledWith(
      'dl2',
      '/tmp/downloads/file.tmp',
      ['http://a'],
      500,
      1000,
      expect.any(Number),
      res.unfinishedChunks,
      expect.any(Function),
      expect.any(Object)
    );
    expect(callback).toHaveBeenCalledWith(null, 'dl2');
  });
});