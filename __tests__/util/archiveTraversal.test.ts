import * as fs from 'fs';
import * as path from 'path';
import { validateExtractionWithinDest } from '../../src/util/archive';

jest.mock('fs');

describe('validateExtractionWithinDest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('passes when all entries are within dest', () => {
    const dest = '/dest';
    (fs.realpathSync as unknown as jest.Mock).mockImplementation((p: string) => {
      return p;
    });
    (fs.readdirSync as unknown as jest.Mock).mockImplementation((dir: string) => {
      if (dir === dest) {
        return [
          { name: 'a', isDirectory: () => false },
          { name: 'b', isDirectory: () => true },
        ];
      } else if (dir === path.join(dest, 'b')) {
        return [
          { name: 'c', isDirectory: () => false },
        ];
      }
      return [];
    });

    expect(() => validateExtractionWithinDest(dest)).not.toThrow();
  });

  test('throws when entry escapes dest path', () => {
    const dest = '/dest';
    (fs.realpathSync as unknown as jest.Mock).mockImplementation((p: string) => {
      if (p === dest) return dest;
      if (p === path.join(dest, 'a')) return '/outside/a';
      return p;
    });
    (fs.readdirSync as unknown as jest.Mock).mockImplementation((dir: string) => {
      if (dir === dest) {
        return [
          { name: 'a', isDirectory: () => false },
        ];
      }
      return [];
    });

    expect(() => validateExtractionWithinDest(dest)).toThrow(/escapes destination/);
  });
});