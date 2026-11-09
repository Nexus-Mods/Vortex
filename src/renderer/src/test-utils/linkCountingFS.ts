import { InMemoryFS, type QualifiedPath, type StatResult } from "@vortex/shared/filesystem";

/** InMemoryFS with each file's hardlinks counted, as a real disk reports them. */
export class LinkCountingFS extends InMemoryFS {
  readonly #extraLinks = new Map<bigint, number>();

  override async createLink(
    from: QualifiedPath,
    to: QualifiedPath,
    type: "hardlink" | "symlink",
  ): Promise<void> {
    await super.createLink(from, to, type);
    const status = await super.stat(to);
    if (type === "hardlink" && status.exists) {
      this.#extraLinks.set(status.id, (this.#extraLinks.get(status.id) ?? 0) + 1);
    }
  }

  override async delete(path: QualifiedPath): Promise<void> {
    const status = await super.stat(path);
    await super.delete(path);
    if (!status.exists) {
      return;
    }
    const extra = this.#extraLinks.get(status.id) ?? 0;
    if (extra > 0) {
      this.#extraLinks.set(status.id, extra - 1);
    }
  }

  override async stat(
    path: QualifiedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult> {
    const status = await super.stat(path, options);
    return status.exists
      ? { ...status, hardlinkCount: 1 + (this.#extraLinks.get(status.id) ?? 0) }
      : status;
  }
}
