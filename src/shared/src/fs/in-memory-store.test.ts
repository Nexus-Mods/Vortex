import { assert, describe, expect, it } from "vitest";

import type { StatusTime } from "./filesystem";
import type { DirNode, FileNode, Node, SymlinkNode } from "./in-memory-store";
import { InMemoryStore } from "./in-memory-store";
import { QualifiedPath } from "./paths";

const DEFAULT_INSTANT = Temporal.Instant.from("2020-01-01T00:00:00Z");

function times(): StatusTime {
  return {
    accessTime: DEFAULT_INSTANT,
    modifiedTime: DEFAULT_INSTANT,
    changeTime: DEFAULT_INSTANT,
    creationTime: DEFAULT_INSTANT,
  };
}

function dirNode(store: InMemoryStore, name: string): DirNode {
  return {
    type: "dir",
    id: store.nextId(),
    name,
    times: times(),
    children: new Map(),
  };
}

function fileNode(store: InMemoryStore, name: string, contents: string): FileNode {
  return {
    type: "file",
    id: store.nextId(),
    name,
    times: times(),
    contents: new TextEncoder().encode(contents),
  };
}

function symlinkNode(store: InMemoryStore, name: string, target: QualifiedPath): SymlinkNode {
  return {
    type: "symlink",
    id: store.nextId(),
    name,
    times: times(),
    target,
  };
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    typeof entry === "bigint" ? entry.toString() : entry,
  );
}

function seedDir(store: InMemoryStore, path: QualifiedPath): DirNode {
  const result = store.ensureDirectory(path);
  assert(result.ok, `seed failed: ${stringify(result)}`);
  return result.dir;
}

function seedEntry(store: InMemoryStore, path: QualifiedPath, node: Node): void {
  const ensure = store.ensureDirectory(path.parent());
  assert(ensure.ok, `seed failed: ${stringify(ensure)}`);
  const attach = store.attach(path, node);
  assert(attach.ok, `seed failed: ${stringify(attach)}`);
}

function seedFile(store: InMemoryStore, path: QualifiedPath, contents: string): FileNode {
  const node = fileNode(store, path.basename, contents);
  seedEntry(store, path, node);
  return node;
}

describe("InMemoryStore.lookup", () => {
  it("resolves files and directories with their parent and key", () => {
    const store = new InMemoryStore();
    const dir = seedDir(store, QualifiedPath.fromNative("/root/sub"));
    const file = seedFile(store, QualifiedPath.fromNative("/root/sub/data.txt"), "hello");

    const fileResult = store.lookup(QualifiedPath.fromNative("/root/sub/data.txt"));
    assert(fileResult.ok);
    expect(fileResult.node).toBe(file);
    expect(fileResult.parent).toBe(dir);
    expect(fileResult.key).toBe("data.txt");

    const dirResult = store.lookup(QualifiedPath.fromNative("/root/sub"));
    assert(dirResult.ok);
    expect(dirResult.node).toBe(dir);
  });

  it("matches paths case-insensitively", () => {
    const store = new InMemoryStore();
    const file = seedFile(store, QualifiedPath.fromNative("/Dir/File.TXT"), "hello");

    const result = store.lookup(QualifiedPath.fromNative("/DIR/FILE.txt"));
    assert(result.ok);
    expect(result.node).toBe(file);
    expect(result.key).toBe("file.txt");
  });

  it("reports missing-entry for a missing component or unknown root", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/root"));

    const missingComponent = store.lookup(QualifiedPath.fromNative("/root/missing"));
    assert(!missingComponent.ok);
    expect(missingComponent.failure).toEqual({
      type: "missing-entry",
      path: QualifiedPath.fromNative("/root/missing"),
    });

    const unknownRoot = store.lookup(QualifiedPath.fromNative("C:/x"));
    assert(!unknownRoot.ok);
    expect(unknownRoot.failure.type).toBe("missing-entry");
  });

  it("reports not-a-directory when a file blocks the walk", () => {
    const store = new InMemoryStore();
    seedFile(store, QualifiedPath.fromNative("/file.txt"), "hello");

    const result = store.lookup(QualifiedPath.fromNative("/file.txt/child"));
    assert(!result.ok);
    expect(result.failure.type).toBe("not-a-directory");
  });

  it("resolves a store root with itself as parent and an empty key", () => {
    const store = new InMemoryStore();
    const root = seedDir(store, QualifiedPath.fromNative("/"));

    const result = store.lookup(QualifiedPath.fromNative("/"));
    assert(result.ok);
    expect(result.node).toBe(root);
    expect(result.parent).toBe(root);
    expect(result.key).toBe("");
  });

  it("follows symlinks in intermediate and final components", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/target"));
    const file = seedFile(store, QualifiedPath.fromNative("/target/data.txt"), "hello");
    seedDir(store, QualifiedPath.fromNative("/a"));
    seedEntry(
      store,
      QualifiedPath.fromNative("/link"),
      symlinkNode(store, "link", QualifiedPath.fromNative("/target/data.txt")),
    );
    seedEntry(
      store,
      QualifiedPath.fromNative("/a/link"),
      symlinkNode(store, "link", QualifiedPath.fromNative("/target")),
    );

    const throughLink = store.lookup(QualifiedPath.fromNative("/link"));
    assert(throughLink.ok);
    expect(throughLink.node).toBe(file);

    const throughIntermediate = store.lookup(QualifiedPath.fromNative("/a/link/data.txt"));
    assert(throughIntermediate.ok);
    expect(throughIntermediate.node).toBe(file);
  });

  it("stops at a final symlink with parseSymLink", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/target"));
    const file = seedFile(store, QualifiedPath.fromNative("/target/data.txt"), "hello");
    const link = symlinkNode(store, "link", QualifiedPath.fromNative("/target/data.txt"));
    seedEntry(store, QualifiedPath.fromNative("/link"), link);

    const stopped = store.lookup(QualifiedPath.fromNative("/link"), { parseSymLink: true });
    assert(stopped.ok);
    expect(stopped.node).toBe(link);

    const plain = store.lookup(QualifiedPath.fromNative("/target/data.txt"), {
      parseSymLink: true,
    });
    assert(plain.ok);
    expect(plain.node).toBe(file);
  });

  it("reports symlink-loop for cyclic links", () => {
    const store = new InMemoryStore();
    seedEntry(
      store,
      QualifiedPath.fromNative("/l1"),
      symlinkNode(store, "l1", QualifiedPath.fromNative("/l2")),
    );
    seedEntry(
      store,
      QualifiedPath.fromNative("/l2"),
      symlinkNode(store, "l2", QualifiedPath.fromNative("/l1")),
    );

    const result = store.lookup(QualifiedPath.fromNative("/l1"));
    assert(!result.ok);
    expect(result.failure.type).toBe("symlink-loop");
  });

  it("reports missing-entry for a dangling symlink", () => {
    const store = new InMemoryStore();
    seedEntry(
      store,
      QualifiedPath.fromNative("/dangling"),
      symlinkNode(store, "dangling", QualifiedPath.fromNative("/missing")),
    );

    const result = store.lookup(QualifiedPath.fromNative("/dangling"));
    assert(!result.ok);
    expect(result.failure.type).toBe("missing-entry");
  });
});

describe("InMemoryStore.attach", () => {
  it("attaches into a root and a nested directory and returns the parent", () => {
    const store = new InMemoryStore();
    const root = seedDir(store, QualifiedPath.fromNative("/"));
    const dir = seedDir(store, QualifiedPath.fromNative("/root/sub"));

    const node = fileNode(store, "top.txt", "one");
    const rootAttach = store.attach(QualifiedPath.fromNative("/top.txt"), node);
    assert(rootAttach.ok);
    expect(rootAttach.parent).toBe(root);
    const rootLookup = store.lookup(QualifiedPath.fromNative("/top.txt"));
    assert(rootLookup.ok);
    expect(rootLookup.node).toBe(node);

    const nested = fileNode(store, "nested.txt", "two");
    const nestedAttach = store.attach(QualifiedPath.fromNative("/root/sub/nested.txt"), nested);
    assert(nestedAttach.ok);
    expect(nestedAttach.parent).toBe(dir);
  });

  it("reports target-exists without overwrite and replaces with overwrite", () => {
    const store = new InMemoryStore();
    const first = fileNode(store, "data.txt", "one");
    seedEntry(store, QualifiedPath.fromNative("/data.txt"), first);

    const second = fileNode(store, "data.txt", "two");
    const blocked = store.attach(QualifiedPath.fromNative("/data.txt"), second);
    assert(!blocked.ok);
    expect(blocked.failure.type).toBe("target-exists");

    const replaced = store.attach(QualifiedPath.fromNative("/data.txt"), second, {
      overwrite: true,
    });
    assert(replaced.ok);
    const lookup = store.lookup(QualifiedPath.fromNative("/data.txt"));
    assert(lookup.ok);
    expect(lookup.node).toBe(second);
  });

  it("does not create missing parents", () => {
    const store = new InMemoryStore();
    const node = fileNode(store, "child.txt", "hello");

    const result = store.attach(QualifiedPath.fromNative("/missing/child.txt"), node);
    assert(!result.ok);
    expect(result.failure.type).toBe("missing-entry");
  });

  it("reports not-a-directory when the parent path is a file", () => {
    const store = new InMemoryStore();
    seedFile(store, QualifiedPath.fromNative("/file.txt"), "hello");

    const result = store.attach(
      QualifiedPath.fromNative("/file.txt/child.txt"),
      fileNode(store, "child.txt", ""),
    );
    assert(!result.ok);
    expect(result.failure.type).toBe("not-a-directory");
  });

  it("refuses to attach onto a store root", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/"));

    const result = store.attach(QualifiedPath.fromNative("/"), dirNode(store, "/"));
    assert(!result.ok);
    expect(result.failure.type).toBe("target-exists");
  });

  it("attaches the same node object at two paths", () => {
    const store = new InMemoryStore();
    const node = fileNode(store, "shared.txt", "hello");
    seedEntry(store, QualifiedPath.fromNative("/one/shared.txt"), node);
    seedEntry(store, QualifiedPath.fromNative("/two/shared.txt"), node);

    const first = store.lookup(QualifiedPath.fromNative("/one/shared.txt"));
    assert(first.ok);
    const second = store.lookup(QualifiedPath.fromNative("/two/shared.txt"));
    assert(second.ok);
    expect(first.node).toBe(node);
    expect(second.node).toBe(node);
  });

  it("reports target-exists for a case-insensitive collision", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/dir"));
    const first = fileNode(store, "File.TXT", "one");
    const firstAttach = store.attach(QualifiedPath.fromNative("/dir/File.TXT"), first);
    assert(firstAttach.ok);

    const second = fileNode(store, "file.txt", "two");
    const result = store.attach(QualifiedPath.fromNative("/dir/file.txt"), second);
    assert(!result.ok);
    expect(result.failure.type).toBe("target-exists");
  });
});

describe("InMemoryStore.detach", () => {
  it("detaches a file and leaves siblings intact", () => {
    const store = new InMemoryStore();
    const file = seedFile(store, QualifiedPath.fromNative("/dir/data.txt"), "hello");
    const siblingFile = seedFile(store, QualifiedPath.fromNative("/dir/other.txt"), "world");

    const result = store.detach(QualifiedPath.fromNative("/dir/data.txt"));
    assert(result.ok);
    expect(result.node).toBe(file);

    const removed = store.lookup(QualifiedPath.fromNative("/dir/data.txt"));
    assert(!removed.ok);
    expect(removed.failure.type).toBe("missing-entry");

    const sibling = store.lookup(QualifiedPath.fromNative("/dir/other.txt"));
    assert(sibling.ok);
    expect(sibling.node).toBe(siblingFile);
  });

  it("detaches a directory together with its children", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/dir"));
    seedFile(store, QualifiedPath.fromNative("/dir/child.txt"), "hello");

    const result = store.detach(QualifiedPath.fromNative("/dir"));
    assert(result.ok);
    expect(result.node.type).toBe("dir");

    const removedChild = store.lookup(QualifiedPath.fromNative("/dir/child.txt"));
    assert(!removedChild.ok);
    expect(removedChild.failure.type).toBe("missing-entry");
  });

  it("reports missing-entry for a missing path", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/dir"));

    const result = store.detach(QualifiedPath.fromNative("/dir/missing.txt"));
    assert(!result.ok);
    expect(result.failure.type).toBe("missing-entry");
  });

  it("reports no-parent for a store root", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/"));

    const result = store.detach(QualifiedPath.fromNative("/"));
    assert(!result.ok);
    expect(result.failure.type).toBe("no-parent");
  });

  it("detaches a symlink itself, not its target", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/target"));
    const file = seedFile(store, QualifiedPath.fromNative("/target/data.txt"), "hello");
    const link = symlinkNode(store, "link", QualifiedPath.fromNative("/target/data.txt"));
    seedEntry(store, QualifiedPath.fromNative("/link"), link);

    const result = store.detach(QualifiedPath.fromNative("/link"));
    assert(result.ok);
    expect(result.node).toBe(link);

    const target = store.lookup(QualifiedPath.fromNative("/target/data.txt"));
    assert(target.ok);
    expect(target.node).toBe(file);
  });

  it("supports move by detach and reattach", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/one"));
    seedDir(store, QualifiedPath.fromNative("/two"));
    const file = seedFile(store, QualifiedPath.fromNative("/one/data.txt"), "hello");

    const detached = store.detach(QualifiedPath.fromNative("/one/data.txt"));
    assert(detached.ok);
    const attached = store.attach(QualifiedPath.fromNative("/two/renamed.txt"), detached.node);
    assert(attached.ok);

    const moved = store.lookup(QualifiedPath.fromNative("/two/renamed.txt"));
    assert(moved.ok);
    expect(moved.node).toBe(file);

    const gone = store.lookup(QualifiedPath.fromNative("/one/data.txt"));
    assert(!gone.ok);
    expect(gone.failure.type).toBe("missing-entry");
  });
});

describe("InMemoryStore.removeEntry", () => {
  it("removes a file", () => {
    const store = new InMemoryStore();
    const file = seedFile(store, QualifiedPath.fromNative("/dir/data.txt"), "hello");

    const result = store.removeEntry(QualifiedPath.fromNative("/dir/data.txt"));
    assert(result.ok);
    expect(result.node).toBe(file);

    const gone = store.lookup(QualifiedPath.fromNative("/dir/data.txt"));
    assert(!gone.ok);
    expect(gone.failure.type).toBe("missing-entry");
  });

  it("refuses to remove a non-empty directory and removes it once empty", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/dir"));
    seedFile(store, QualifiedPath.fromNative("/dir/child.txt"), "hello");

    const blocked = store.removeEntry(QualifiedPath.fromNative("/dir"));
    assert(!blocked.ok);
    expect(blocked.failure.type).toBe("not-empty");

    const childRemoval = store.removeEntry(QualifiedPath.fromNative("/dir/child.txt"));
    assert(childRemoval.ok);
    const emptyRemoval = store.removeEntry(QualifiedPath.fromNative("/dir"));
    assert(emptyRemoval.ok);
  });

  it("reports missing-entry for a missing path", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/dir"));

    const result = store.removeEntry(QualifiedPath.fromNative("/dir/missing.txt"));
    assert(!result.ok);
    expect(result.failure.type).toBe("missing-entry");
  });

  it("reports no-parent for a store root", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/"));

    const result = store.removeEntry(QualifiedPath.fromNative("/"));
    assert(!result.ok);
    expect(result.failure.type).toBe("no-parent");
  });

  it("removes a symlink itself, not its target", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/target"));
    const file = seedFile(store, QualifiedPath.fromNative("/target/data.txt"), "hello");
    const link = symlinkNode(store, "link", QualifiedPath.fromNative("/target/data.txt"));
    seedEntry(store, QualifiedPath.fromNative("/link"), link);

    const result = store.removeEntry(QualifiedPath.fromNative("/link"));
    assert(result.ok);
    expect(result.node).toBe(link);

    const target = store.lookup(QualifiedPath.fromNative("/target/data.txt"));
    assert(target.ok);
    expect(target.node).toBe(file);
  });
});

describe("InMemoryStore.ensureDirectory", () => {
  it("creates all missing parents in one call", () => {
    const store = new InMemoryStore();

    const result = store.ensureDirectory(QualifiedPath.fromNative("/a/b/c"));
    assert(result.ok);
    expect(result.dir.name).toBe("c");

    for (const path of ["/a", "/a/b", "/a/b/c"]) {
      const lookup = store.lookup(QualifiedPath.fromNative(path));
      assert(lookup.ok);
      expect(lookup.node.type).toBe("dir");
    }
  });

  it("returns the existing directory unchanged", () => {
    const store = new InMemoryStore();
    const first = seedDir(store, QualifiedPath.fromNative("/dir"));
    const file = seedFile(store, QualifiedPath.fromNative("/dir/data.txt"), "hello");

    const second = store.ensureDirectory(QualifiedPath.fromNative("/dir"));
    assert(second.ok);
    expect(second.dir).toBe(first);
    const lookup = store.lookup(QualifiedPath.fromNative("/dir/data.txt"));
    assert(lookup.ok);
    expect(lookup.node).toBe(file);
  });

  it("creates unknown store roots on demand", () => {
    const store = new InMemoryStore();

    const first = store.ensureDirectory(QualifiedPath.fromNative("C:/data/sub"));
    assert(first.ok);

    const root = store.ensureDirectory(QualifiedPath.fromNative("C:/"));
    assert(root.ok);
    const lookup = store.lookup(QualifiedPath.fromNative("C:/data/sub"));
    assert(lookup.ok);
    expect(lookup.node).toBe(first.dir);

    const rootLookup = store.lookup(QualifiedPath.fromNative("C:/"));
    assert(rootLookup.ok);
    expect(root.dir).toBe(rootLookup.node);
  });

  it("creates the partition root itself", () => {
    const store = new InMemoryStore();

    const result = store.ensureDirectory(QualifiedPath.fromNative("/"));
    assert(result.ok);
    expect(result.dir.type).toBe("dir");

    const lookup = store.lookup(QualifiedPath.fromNative("/"));
    assert(lookup.ok);
    expect(lookup.node).toBe(result.dir);
  });

  it("reports not-a-directory when a file blocks the walk", () => {
    const store = new InMemoryStore();
    seedFile(store, QualifiedPath.fromNative("/file.txt"), "hello");

    const result = store.ensureDirectory(QualifiedPath.fromNative("/file.txt/sub"));
    assert(!result.ok);
    expect(result.failure.type).toBe("not-a-directory");
  });

  it("reports not-a-directory when the target is a file", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/dir"));
    seedFile(store, QualifiedPath.fromNative("/dir/data.txt"), "hello");

    const result = store.ensureDirectory(QualifiedPath.fromNative("/dir/data.txt"));
    assert(!result.ok);
    expect(result.failure.type).toBe("not-a-directory");
  });

  it("follows symlink components to a directory", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/target"));
    seedDir(store, QualifiedPath.fromNative("/a"));
    seedEntry(
      store,
      QualifiedPath.fromNative("/a/link"),
      symlinkNode(store, "link", QualifiedPath.fromNative("/target")),
    );

    const result = store.ensureDirectory(QualifiedPath.fromNative("/a/link/sub"));
    assert(result.ok);

    const lookup = store.lookup(QualifiedPath.fromNative("/target/sub"));
    assert(lookup.ok);
    expect(lookup.node).toBe(result.dir);
  });

  it("reports not-a-directory when a symlink component resolves to a file", () => {
    const store = new InMemoryStore();
    seedDir(store, QualifiedPath.fromNative("/target"));
    seedFile(store, QualifiedPath.fromNative("/target/data.txt"), "hello");
    seedEntry(
      store,
      QualifiedPath.fromNative("/link"),
      symlinkNode(store, "link", QualifiedPath.fromNative("/target/data.txt")),
    );

    const result = store.ensureDirectory(QualifiedPath.fromNative("/link"));
    assert(!result.ok);
    expect(result.failure.type).toBe("not-a-directory");
  });

  it("reports missing-entry for a dangling symlink component", () => {
    const store = new InMemoryStore();
    seedEntry(
      store,
      QualifiedPath.fromNative("/link"),
      symlinkNode(store, "link", QualifiedPath.fromNative("/missing")),
    );

    const result = store.ensureDirectory(QualifiedPath.fromNative("/link/sub"));
    assert(!result.ok);
    expect(result.failure.type).toBe("missing-entry");
  });

  it("reports symlink-loop for cyclic link components", () => {
    const store = new InMemoryStore();
    seedEntry(
      store,
      QualifiedPath.fromNative("/l1"),
      symlinkNode(store, "l1", QualifiedPath.fromNative("/l2")),
    );
    seedEntry(
      store,
      QualifiedPath.fromNative("/l2"),
      symlinkNode(store, "l2", QualifiedPath.fromNative("/l1")),
    );

    const result = store.ensureDirectory(QualifiedPath.fromNative("/l1/sub"));
    assert(!result.ok);
    expect(result.failure.type).toBe("symlink-loop");
  });

  it("preserves original casing in created node names", () => {
    const store = new InMemoryStore();

    const result = store.ensureDirectory(QualifiedPath.fromNative("/My Dir/Sub"));
    assert(result.ok);
    expect(result.dir.name).toBe("Sub");

    const lookup = store.lookup(QualifiedPath.fromNative("/my dir/sub"));
    assert(lookup.ok);
    expect(lookup.node).toBe(result.dir);
    expect(lookup.parent.name).toBe("My Dir");
  });
});
