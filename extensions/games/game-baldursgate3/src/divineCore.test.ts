/**
 * End-to-end tests for divineCore against the real divine.exe shipped in
 * extensions/games/game-baldursgate3/tools/. No mocks: a .pak is built in
 * beforeAll via `create-package` from src/__fixtures__/pakSource, then the
 * runner is exercised against that pak.
 *
 * divine.exe is a Windows .NET binary and requires .NET 8 Desktop Runtime.
 * The whole suite is skipped on non-win32 platforms.
 */
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  DivineAborted,
  DivineExecMissing,
  DivinePakInvalid,
  extractPakCore,
  IExecErrorShape,
  listPackageCore,
  runDivineCore,
  translateDivineError,
} from './divineCore';

const DIVINE_EXE = path.join(__dirname, '..', 'tools', 'divine.exe');
const PAK_SOURCE = path.join(__dirname, '__fixtures__', 'pakSource');

const isWindows = process.platform === 'win32';

describe.skipIf(!isWindows)('divineCore end-to-end', () => {
  let tempDir: string;
  let testPak: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'divinecore-'));
    testPak = path.join(tempDir, 'test.pak');
    await runDivineCore(DIVINE_EXE, 'create-package', {
      source: PAK_SOURCE,
      destination: testPak,
    });
  });

  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('listPackageCore', () => {
    test('returns entries for every file packed into the pak', async () => {
      const entries = await listPackageCore(DIVINE_EXE, testPak);

      // divine emits one line per file, often with size metadata. We just
      // care that both source files show up somewhere in the output.
      const joined = entries.join('\n');
      expect(joined).toMatch(/meta\.lsx/);
      expect(joined).toMatch(/readme\.txt/);
      expect(entries.length).toBeGreaterThanOrEqual(2);
    });

    test('rejects with DivineExecMissing when the exe path does not exist', async () => {
      const missingExe = path.join(tempDir, 'no-such-divine.exe');

      await expect(listPackageCore(missingExe, testPak))
        .rejects.toBeInstanceOf(DivineExecMissing);
    });

    test('rejects with DivinePakInvalid for a pak that does not exist', async () => {
      // divine.exe reports the missing-file condition via [FATAL] on stdout
      // and exits non-zero — classified as an invalid pak rather than a
      // generic "divine failed" error so loadOrder.ts can suppress it.
      const bogusPak = path.join(tempDir, 'does-not-exist.pak');

      await expect(listPackageCore(DIVINE_EXE, bogusPak))
        .rejects.toBeInstanceOf(DivinePakInvalid);
    });

    test('rejects with DivineAborted when the signal is pre-aborted', async () => {
      const ac = new AbortController();
      ac.abort();

      await expect(
        listPackageCore(DIVINE_EXE, testPak, { signal: ac.signal }),
      ).rejects.toBeInstanceOf(DivineAborted);
    });

    test('rejects with DivineAborted when the signal fires mid-flight', async () => {
      const ac = new AbortController();
      const op = listPackageCore(DIVINE_EXE, testPak, { signal: ac.signal });
      // Fire before the child process can finish; divine.exe startup is the
      // slow part so this almost always lands during exec.
      ac.abort();

      await expect(op).rejects.toBeInstanceOf(DivineAborted);
    });
  });

  describe('listPackageCore corrupted pak handling', () => {
    test('rejects with DivinePakInvalid for a pak containing unrelated garbage', async () => {
      // divine.exe reports format errors on stdout (not stderr, not exit code).
      // With the default loglevel=error, the [ERROR] line is detected and
      // surfaced as DivinePakInvalid so callers can classify + suppress
      // per-pak noise. The exact wording of divine's error is not asserted —
      // only that the bracketed marker was captured.
      const corruptPak = path.join(tempDir, 'corrupt.pak');
      await fs.writeFile(corruptPak, 'this is not an LSPK archive');

      const op = listPackageCore(DIVINE_EXE, corruptPak);
      await expect(op).rejects.toBeInstanceOf(DivinePakInvalid);
      await expect(op).rejects.toSatisfy(
        (err: DivinePakInvalid) => /\[(?:ERROR|FATAL)\]/i.test(err.details),
      );
    });

    test('silently succeeds on a garbage pak when loglevel=off suppresses divine errors', async () => {
      // Regression guard: loglevel=off silences divine's stdout error
      // reporting entirely, so callers that opt into 'off' lose the ability
      // to detect malformed paks — documented behaviour.
      const corruptPak = path.join(tempDir, 'corrupt-silent.pak');
      await fs.writeFile(corruptPak, 'this is not an LSPK archive');

      const res = await runDivineCore(DIVINE_EXE, 'list-package', {
        source: corruptPak,
        loglevel: 'off',
      });

      expect(res.stdout).toBe('');
    });

    test('rejects with DivinePakInvalid for a truncated pak', async () => {
      const truncatedPak = path.join(tempDir, 'truncated.pak');
      const realPak = await fs.readFile(testPak);
      await fs.writeFile(truncatedPak, realPak.subarray(0, 16));

      await expect(listPackageCore(DIVINE_EXE, truncatedPak))
        .rejects.toBeInstanceOf(DivinePakInvalid);
    });

    test('rejects with DivinePakInvalid for an empty pak file', async () => {
      const emptyPak = path.join(tempDir, 'empty.pak');
      await fs.writeFile(emptyPak, '');

      await expect(listPackageCore(DIVINE_EXE, emptyPak))
        .rejects.toBeInstanceOf(DivinePakInvalid);
    });
  });

  describe('extractPakCore', () => {
    test('extracts files matching the pattern into the destination', async () => {
      const extractDir = path.join(tempDir, 'extracted-all');
      await fs.mkdir(extractDir, { recursive: true });

      await extractPakCore(DIVINE_EXE, testPak, extractDir, '*');

      // divine may place files in a subdirectory reflecting the pak layout.
      // Walk recursively and assert both fixtures are present somewhere.
      const found = await collectFileNames(extractDir);
      expect(found).toContain('meta.lsx');
      expect(found).toContain('readme.txt');
    });

    test('honours the glob expression and skips non-matching files', async () => {
      const extractDir = path.join(tempDir, 'extracted-txt');
      await fs.mkdir(extractDir, { recursive: true });

      await extractPakCore(DIVINE_EXE, testPak, extractDir, '*.txt');

      const found = await collectFileNames(extractDir);
      expect(found).toContain('readme.txt');
      expect(found).not.toContain('meta.lsx');
    });
  });
});

describe('translateDivineError', () => {
  // Pure unit tests: no real divine scenario produces the generic enriched
  // branch anymore (every observed failure mode carries a [ERROR]/[FATAL]
  // marker and classifies as DivinePakInvalid). These guard the enrichment
  // format for future divine versions or crash-without-output cases.
  test('embeds action, exit code, and trimmed stderr when no bracketed marker is present', () => {
    const err: IExecErrorShape = {
      code: 2,
      stderr: '  something broke\n',
      stdout: '',
      message: 'Command failed: divine.exe ...',
    };

    const translated = translateDivineError(err, 'extract-package', false);

    expect(translated).not.toBeInstanceOf(DivinePakInvalid);
    expect(translated.message).toBe(
      'divine.exe failed: action=extract-package; exitCode=2; stderr=something broke',
    );
  });

  test('includes stdout only when stderr is empty and stdout has no bracketed marker', () => {
    const err: IExecErrorShape = {
      code: 3,
      stderr: '',
      stdout: 'something on stdout',
    };

    const translated = translateDivineError(err, 'list-package', false);

    expect(translated.message).toContain('stdout=something on stdout');
  });

  test('falls back to err.message when exec produced no structured detail', () => {
    const err: IExecErrorShape = { message: 'Command failed' };

    expect(translateDivineError(err, 'list-package', false).message)
      .toBe('divine.exe failed: Command failed');
  });

  test('abort takes precedence over SIGTERM timeout', () => {
    // A cancelled child is also SIGTERM-killed, so the abort check must
    // short-circuit before the timeout branch.
    const err: IExecErrorShape = { signal: 'SIGTERM' };

    expect(translateDivineError(err, 'list-package', true))
      .toBeInstanceOf(DivineAborted);
  });
});

async function collectFileNames(dir: string): Promise<string[]> {
  const names: string[] = [];
  const walk = async (current: string): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        names.push(entry.name);
      }
    }
  };
  await walk(dir);
  return names;
}
