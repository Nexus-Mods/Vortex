/* eslint-disable vortex/no-module-imports */
/**
 * Integration tests - End-to-end scenarios
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

import { FilePath } from '../FilePath';
import { FilePathIPC } from '../ipc';
import { ResolverRegistry } from '../ResolverRegistry';
import { BaseResolver } from '../resolvers/BaseResolver';
import { RelativePath, Anchor, ResolvedPath } from '../types';

// Test resolver implementations
class AppResolver extends BaseResolver<'userData' | 'temp'> {
  constructor() {
    super('app');
  }

  canResolve(anchor: Anchor): boolean {
    const name = Anchor.name(anchor);
    return name === 'userData' || name === 'temp';
  }

  supportedAnchors(): Anchor[] {
    return ['userData', 'temp'].map(Anchor.make);
  }

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    return this.resolveAnchorSync(anchor);
  }

  protected resolveAnchorSync(anchor: Anchor): ResolvedPath {
    const name = Anchor.name(anchor);
    if (name === 'userData') {
      return ResolvedPath.make('/home/user/.local/share/app');
    }
    if (name === 'temp') {
      return ResolvedPath.make('/tmp');
    }
    throw new Error(`Unknown anchor: ${name}`);
  }
}

class GameResolver extends BaseResolver<'game' | 'gameMods'> {
  constructor() {
    super('game');
  }

  canResolve(anchor: Anchor): boolean {
    const name = Anchor.name(anchor);
    return name === 'game' || name === 'gameMods';
  }

  supportedAnchors(): Anchor[] {
    return ['game', 'gameMods'].map(Anchor.make);
  }

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    return this.resolveAnchorSync(anchor);
  }

  protected resolveAnchorSync(anchor: Anchor): ResolvedPath {
    const name = Anchor.name(anchor);
    if (name === 'game') {
      return ResolvedPath.make('/games/skyrim');
    }
    if (name === 'gameMods') {
      return ResolvedPath.make('/games/skyrim/Data');
    }
    throw new Error(`Unknown anchor: ${name}`);
  }
}

describe('Integration Tests', () => {
  let appResolver: AppResolver;
  let gameResolver: GameResolver;
  let registry: ResolverRegistry;

  beforeEach(() => {
    appResolver = new AppResolver();
    gameResolver = new GameResolver();
    registry = new ResolverRegistry();
    registry.register(appResolver);
    registry.register(gameResolver);
    registry.setDefault(gameResolver);
  });

  describe('path operations', () => {
    test('build complex paths with joins', async () => {
      const base = gameResolver.PathFor('gameMods');
      const modPath = base.join('skyui', 'interface', 'skyui.swf');

      expect(modPath.relative).toBe('skyui/interface/skyui.swf');
      const resolved = await modPath.resolve();
      expect(resolved).toBe('/games/skyrim/Data/skyui/interface/skyui.swf');
    });

    test('navigate parent directories', async () => {
      const filePath = gameResolver.PathFor('gameMods', 'skyui/interface/skyui.swf');
      const interfaceDir = filePath.parent();
      const skyuiDir = interfaceDir.parent();

      expect(skyuiDir.relative).toBe('skyui');
      const resolved = await skyuiDir.resolve();
      expect(resolved).toBe('/games/skyrim/Data/skyui');
    });
  });

  describe('IPC serialization round-trip', () => {
    test('serialize, send, and deserialize FilePath', async () => {
      // Original path
      const original = gameResolver.PathFor('game', 'mods/skyrim');

      // Serialize (as if sending over IPC)
      const serialized = FilePathIPC.serialize(original);
      expect(serialized).toEqual({
        relative: 'mods/skyrim',
        anchor: 'game',
        resolverName: 'game',
      });

      // Deserialize (as if receiving from IPC)
      const deserialized = FilePathIPC.deserialize(serialized, registry);

      // Should resolve to same path
      expect(await deserialized.resolve()).toBe(await original.resolve());
    });

    test('serialize resolved paths for simple IPC', async () => {
      const filePath = gameResolver.PathFor('game', 'mods');
      const resolved = await FilePathIPC.serializeResolved(filePath);

      // Can reconstruct ResolvedPath on receiving side
      const reconstructed = ResolvedPath.make(resolved);
      expect(reconstructed).toBe(resolved);
    });
  });

  describe('type safety', () => {
    test('PathFor enforces valid anchor names', () => {
      // These should compile (TypeScript check)
      gameResolver.PathFor('game');
      gameResolver.PathFor('gameMods');
      appResolver.PathFor('userData');
      appResolver.PathFor('temp');

      // These would be TypeScript errors:
      // gameResolver.PathFor('invalidAnchor');
      // appResolver.PathFor('game');
    });
  });

  describe('immutability', () => {
    test('builder methods create new instances', () => {
      const original = gameResolver.PathFor('game', 'mods');
      const joined = original.join('skyrim');
      const withAnchor = original.withAnchor(Anchor.make('gameMods'));

      // All different instances
      expect(joined).not.toBe(original);
      expect(withAnchor).not.toBe(original);

      // Original unchanged
      expect(original.relative).toBe('mods');
      expect(joined.relative).toBe('mods/skyrim');
      expect(Anchor.name(withAnchor.anchor)).toBe('gameMods');
    });
  });

  describe('cross-platform path handling', () => {
    test('RelativePath normalizes separators', () => {
      const windowsStyle = RelativePath.make('mods\\skyrim\\data');
      const unixStyle = RelativePath.make('mods/skyrim/data');

      expect(windowsStyle).toBe(unixStyle);
      expect(windowsStyle).toBe('mods/skyrim/data');
    });

    test('ResolvedPath preserves OS separators', () => {
      // Unix path
      const unixPath = ResolvedPath.make('/home/user/mods');
      expect(unixPath).toContain('/');

      // Can join with platform-specific separators
      const joined = ResolvedPath.join(unixPath, 'skyrim', 'data');
      expect(joined).toContain('skyrim');
      expect(joined).toContain('data');
    });
  });

  describe('registry management', () => {
    test('register and retrieve resolvers', () => {
      expect(registry.get('app')).toBe(appResolver);
      expect(registry.get('game')).toBe(gameResolver);
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    test('default resolver', () => {
      expect(registry.getDefault()).toBe(gameResolver);
      expect(registry.hasDefault()).toBe(true);
    });

    test('unregister resolvers', () => {
      expect(registry.unregister('app')).toBe(true);
      expect(registry.get('app')).toBeUndefined();
      expect(registry.unregister('app')).toBe(false);
    });

    test('get stats', () => {
      const stats = registry.getStats();
      expect(stats.totalResolvers).toBe(2);
      expect(stats.resolverNames).toContain('app');
      expect(stats.resolverNames).toContain('game');
      expect(stats.hasDefault).toBe(true);
      expect(stats.defaultName).toBe('game');
    });
  });

  describe('real-world scenario: mod installation', () => {
    test('resolve mod installation paths', async () => {
      // User downloads mod
      const downloadPath = appResolver.PathFor('temp', 'downloads/skyui.zip');
      expect(await downloadPath.resolve()).toBe('/tmp/downloads/skyui.zip');

      // Extract to temp
      const extractPath = appResolver.PathFor('temp', 'extracted/skyui');
      expect(await extractPath.resolve()).toBe('/tmp/extracted/skyui');

      // Install to game mods
      const installPath = gameResolver.PathFor('gameMods', 'skyui');
      expect(await installPath.resolve()).toBe('/games/skyrim/Data/skyui');
    });

    test('track mod file paths', async () => {
      const modFiles = [
        gameResolver.PathFor('gameMods', 'skyui/interface/skyui.swf'),
        gameResolver.PathFor('gameMods', 'skyui/scripts/skyui.pex'),
        gameResolver.PathFor('gameMods', 'skyui/skse/plugins/skyui.dll'),
      ];

      // Serialize for storage
      const serialized = FilePathIPC.serializeMany(modFiles);
      expect(serialized).toHaveLength(3);

      // Later, deserialize and resolve
      const deserialized = FilePathIPC.deserializeMany(serialized, registry);
      const resolved = await Promise.all(
        deserialized.map(p => p.resolve())
      );

      expect(resolved[0]).toBe('/games/skyrim/Data/skyui/interface/skyui.swf');
      expect(resolved[1]).toBe('/games/skyrim/Data/skyui/scripts/skyui.pex');
      expect(resolved[2]).toBe('/games/skyrim/Data/skyui/skse/plugins/skyui.dll');
    });
  });

  describe('OS-specific resolvers (WindowsResolver & UnixResolver)', () => {
    test('resolvers work on any platform', async () => {
      const { WindowsResolver } = await import('../resolvers/WindowsResolver');
      const { UnixResolver } = await import('../resolvers/UnixResolver');

      // WindowsResolver always works
      const windowsResolver = new WindowsResolver();
      const cDrive = windowsResolver.PathFor('c');
      const windowsResolved = await cDrive.resolve();
      expect(windowsResolved).toBe('C:\\');

      // UnixResolver always works
      const unixResolver = new UnixResolver();
      const root = unixResolver.PathFor('root');
      const unixResolved = await root.resolve();
      expect(unixResolved).toBe('/');
    });

    test('resolvers return all anchors regardless of platform', async () => {
      const { WindowsResolver } = await import('../resolvers/WindowsResolver');
      const { UnixResolver } = await import('../resolvers/UnixResolver');

      const windowsResolver = new WindowsResolver();
      expect(windowsResolver.supportedAnchors()).toHaveLength(26);

      const unixResolver = new UnixResolver();
      expect(unixResolver.supportedAnchors()).toHaveLength(1);
    });

    test('WindowsResolver canResolve all 26 drive letters', async () => {
      const { WindowsResolver } = await import('../resolvers/WindowsResolver');
      const resolver = new WindowsResolver();

      const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
      letters.forEach(letter => {
        const anchor = Anchor.make(letter);
        expect(resolver.canResolve(anchor)).toBe(true);
      });
    });

    test('UnixResolver only resolves root anchor', async () => {
      const { UnixResolver } = await import('../resolvers/UnixResolver');
      const resolver = new UnixResolver();

      expect(resolver.canResolve(Anchor.make('root'))).toBe(true);
      expect(resolver.canResolve(Anchor.make('c'))).toBe(false);
      expect(resolver.canResolve(Anchor.make('userData'))).toBe(false);
    });
  });
});
