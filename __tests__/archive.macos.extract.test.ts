import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';

// Mock node-7z so we can assert it isn't used for macOS zip extraction
const mockExtractFull = jest.fn(() => ({
  promise: () => Promise.resolve(),
  on: jest.fn(),
}));
jest.mock('node-7z', () => ({ extractFull: mockExtractFull }));

// Import after mocks so archive.ts picks them up
import { extractArchive } from '../src/util/archive';

describe('extractArchive macOS handling', () => {
  let tempDir: string;
  let archivePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vortex-archive-test-'));
    archivePath = path.join(tempDir, 'macos-test.zip');
    // Write minimal zip magic header: 'PK\x03\x04'
    fs.writeFileSync(archivePath, Buffer.from([0x50, 0x4B, 0x03, 0x04]));
    mockExtractFull.mockClear();
  });

  afterEach(() => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  });

  const maybe = process.platform === 'darwin' ? test : test.skip;

  maybe('uses macOS ditto for zip extraction and does not call node-7z', async () => {
      const cp = require('child_process');
      const spawnCalls: Array<{ cmd: string; args: ReadonlyArray<string> }> = [];
      const spawnMock = jest.spyOn(cp, 'spawn').mockImplementation((...spawnArgs: any[]) => {
        const cmd = spawnArgs[0] as string;
        const args = (spawnArgs[1] ?? []) as ReadonlyArray<string>;
        spawnCalls.push({ cmd, args });
        const proc: any = new EventEmitter();
        proc.stderr = new EventEmitter();
        // Simulate successful ditto extraction
        setImmediate(() => proc.emit('close', 0));
        return proc;
      });

      const dest = path.join(tempDir, 'out');
      fs.mkdirSync(dest);
      await extractArchive(archivePath, dest);

      // Assert ditto was used and 7z was not
      expect(spawnMock).toHaveBeenCalled();
      expect(spawnCalls[0].cmd).toBe('ditto');
      expect(mockExtractFull).not.toHaveBeenCalled();

      spawnMock.mockRestore();
  });

  maybe('falls back to unzip if ditto fails on macOS', async () => {
      const cp = require('child_process');
      const spawnCalls: Array<{ cmd: string; args: ReadonlyArray<string> }> = [];
      const spawnMock = jest.spyOn(cp, 'spawn').mockImplementation((...spawnArgs: any[]) => {
        const cmd = spawnArgs[0] as string;
        const args = (spawnArgs[1] ?? []) as ReadonlyArray<string>;
        spawnCalls.push({ cmd, args });
        const proc: any = new EventEmitter();
        proc.stderr = new EventEmitter();
        // First call (ditto) fails, second call (unzip) succeeds
        if (cmd === 'ditto') {
          setImmediate(() => proc.emit('close', 1));
        } else {
          setImmediate(() => proc.emit('close', 0));
        }
        return proc;
      });

      const dest = path.join(tempDir, 'out2');
      fs.mkdirSync(dest);
      await extractArchive(archivePath, dest);

      expect(spawnMock).toHaveBeenCalled();
      expect(spawnCalls.length).toBeGreaterThanOrEqual(2);
      expect(spawnCalls[0].cmd).toBe('ditto');
      expect(spawnCalls[1].cmd).toBe('unzip');
      expect(mockExtractFull).not.toHaveBeenCalled();

      spawnMock.mockRestore();
  });
});