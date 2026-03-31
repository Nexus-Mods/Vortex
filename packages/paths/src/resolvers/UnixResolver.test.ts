import { describe, test, expect, beforeEach } from "vitest";

import { UnixResolver, type UnixAnchor } from "./UnixResolver";
import { Anchor } from "../types";
import { MockUnixFilesystem } from "../test-helpers/MockUnixFilesystem";

describe("UnixResolver", () => {
  let resolver: UnixResolver;

  beforeEach(() => {
    resolver = new UnixResolver(undefined, new MockUnixFilesystem());
  });

  describe("basic properties", () => {
    test('identifies as "unix" resolver', () => {
      expect(resolver.name).toBe("unix");
    });

    test('returns single "root" anchor', () => {
      const anchors = resolver.supportedAnchors();
      expect(anchors).toHaveLength(1);

      const anchorNames = anchors.map((a) => Anchor.name(a));
      expect(anchorNames).toContain("root");
    });
  });

  describe("canResolve", () => {
    test('can resolve "root" anchor', () => {
      const anchor = Anchor.make("root");
      expect(resolver.canResolve(anchor)).toBe(true);
    });

    test.each([
      ["c", "Windows drive"],
      ["d", "Windows drive"],
      ["userData", "Vortex anchor"],
      ["game", "Game anchor"],
      ["drive_c", "Proton anchor"],
      ["home", "Unix directory (not anchor)"],
      ["etc", "Unix directory (not anchor)"],
    ])("cannot resolve invalid anchor: %s (%s)", (anchorName) => {
      const anchor = Anchor.make(anchorName);
      expect(resolver.canResolve(anchor)).toBe(false);
    });
  });

  describe("resolveAnchor", () => {
    test('resolves "root" anchor to "/"', async () => {
      const filePath = resolver.PathFor("root");
      const resolved = await filePath.resolve();
      expect(resolved).toBe("/");
    });

    test.each([
      ["home", "/home"],
      ["etc", "/etc"],
      ["usr/local/bin", "/usr/local/bin"],
      ["var/log/syslog", "/var/log/syslog"],
      ["opt", "/opt"],
    ])("PathFor(root, %s) resolves to %s", async (relative, expected) => {
      const path = resolver.PathFor("root", relative);
      const resolved = await path.resolve();
      expect(resolved).toBe(expected);
    });

    test("resolves deeply nested paths", async () => {
      const deepPath = resolver.PathFor(
        "root",
        "home/user/.local/share/vortex",
      );
      const resolved = await deepPath.resolve();
      expect(resolved).toBe("/home/user/.local/share/vortex");
    });

    test("throws for non-root anchor", async () => {
      // Directly test the resolveAnchor method with an invalid anchor
      const invalidAnchor = Anchor.make("invalid");

      await expect(
        (
          resolver as unknown as {
            resolveAnchor: (anchor: typeof invalidAnchor) => Promise<unknown>;
          }
        ).resolveAnchor(invalidAnchor),
      ).rejects.toThrow(/Unknown anchor/);
    });
  });

  describe("PathFor type safety", () => {
    test("creates FilePath with root anchor", () => {
      const root = resolver.PathFor("root");
      expect(Anchor.name(root.anchor)).toBe("root");
      expect(root.relative).toBe("");
    });

    test("creates FilePath with relative path", () => {
      const home = resolver.PathFor("root", "home/user");
      expect(Anchor.name(home.anchor)).toBe("root");
      expect(home.relative).toBe("home/user");
    });

    // TypeScript compile-time checks (these would be errors):
    // resolver.PathFor('c');         // ✗ Error
    // resolver.PathFor('userData');  // ✗ Error
    // resolver.PathFor('home');      // ✗ Error (not an anchor, just a directory)
  });

  describe("path operations", () => {
    test("join creates nested paths", async () => {
      const root = resolver.PathFor("root");
      const home = root.join("home", "user", "Documents");

      expect(home.relative).toBe("home/user/Documents");
      const resolved = await home.resolve();
      expect(resolved).toBe("/home/user/Documents");
    });

    test("parent navigation works correctly", () => {
      const deepPath = resolver.PathFor("root", "home/user/Documents/file.txt");
      const parent1 = deepPath.parent(); // /home/user/Documents
      const parent2 = parent1.parent(); // /home/user
      const parent3 = parent2.parent(); // /home

      expect(parent1.relative).toBe("home/user/Documents");
      expect(parent2.relative).toBe("home/user");
      expect(parent3.relative).toBe("home");
    });

    test("withAnchor preserves relative path", async () => {
      const rootHome = resolver.PathFor("root", "home");

      // Switch to same anchor (should work)
      const sameAnchor = rootHome.withAnchor(Anchor.make("root"));
      expect(await sameAnchor.resolve()).toBe("/home");
    });

    test("relativeTo accepts / as basePath", async () => {
      const file = resolver.PathFor("root", "home/user/file.txt");

      await expect(file.relativeTo("/")).resolves.toBe("home/user/file.txt");
    });

    test("relativeTo with trailing / on a non-root base path", async () => {
      const file = resolver.PathFor("root", "home/user/file.txt");

      await expect(file.relativeTo("/home/user/")).resolves.toBe("file.txt");
    });
  });

  describe("edge cases", () => {
    test("handles empty relative path", async () => {
      const root = resolver.PathFor("root", "");
      const resolved = await root.resolve();
      expect(resolved).toBe("/");
    });

    test("handles paths with forward slashes correctly", async () => {
      const path = resolver.PathFor("root", "home/user/file.txt");
      const resolved = await path.resolve();
      expect(resolved).toBe("/home/user/file.txt");
    });

    test("normalizes backslashes to forward slashes in relative path", async () => {
      // RelativePath.make normalizes backslashes
      const path = resolver.PathFor("root", "home\\user\\file.txt");
      const resolved = await path.resolve();
      // Should be normalized to forward slashes
      expect(resolved).toBe("/home/user/file.txt");
    });
  });

  describe("real-world Unix paths", () => {
    test.each([
      ["/bin", "root", "bin"],
      ["/etc/nginx/nginx.conf", "root", "etc/nginx/nginx.conf"],
      ["/home/user/.bashrc", "root", "home/user/.bashrc"],
      ["/usr/local/bin/node", "root", "usr/local/bin/node"],
      ["/var/www/html/index.html", "root", "var/www/html/index.html"],
      ["/tmp/downloads", "root", "tmp/downloads"],
    ])("resolves %s correctly", async (expected, anchor, relative) => {
      const path = resolver.PathFor(anchor as unknown as UnixAnchor, relative);
      const resolved = await path.resolve();
      expect(resolved).toBe(expected);
    });
  });
});
