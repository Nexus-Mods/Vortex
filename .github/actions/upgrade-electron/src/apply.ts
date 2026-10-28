import { type Plan } from "./plan";
import { setAllowBuildsNode, setElectron, setNodeAbi, setPackageJsonNode } from "./workspace";

export const PACKAGE_JSON = "package.json";
export const WORKSPACE_YAML = "pnpm-workspace.yaml";
export const LOCKFILE = "pnpm-lock.yaml";

/** The only files an upgrade may touch. */
const EXPECTED_CHANGES: ReadonlySet<string> = new Set([PACKAGE_JSON, WORKSPACE_YAML, LOCKFILE]);

/** Side effects of applying a plan, injected so tests can run without pnpm or git. */
export interface ApplyIo {
  /** Reads a file relative to the repository root. */
  readText(file: string): string;
  /** Writes a file relative to the repository root. */
  writeText(file: string, text: string): void;
  /** Runs `pnpm install` with `--frozen-lockfile` or `--no-frozen-lockfile`. */
  install(options: { frozen: boolean }): Promise<void>;
  /** Paths (relative to the repository root) that differ from HEAD. */
  changedFiles(): Promise<string[]>;
  /** Whether the installed node-abi can resolve the ABI of this Electron version. */
  abiKnown(electronVersion: string): Promise<boolean>;
}

const edit = (io: ApplyIo, file: string, transform: (text: string) => string): void => {
  io.writeText(file, transform(io.readText(file)));
};

/**
 * Applies the plan to the working tree. Each edit is followed by an install so
 * pnpm-lock.yaml tracks it. The caller must already have installed with a
 * frozen lockfile, which both proves the lockfile is current before anything is
 * changed and provides the installed node-abi the plan was checked against.
 */
export const applyPlan = async (plan: Plan, io: ApplyIo): Promise<void> => {
  if (plan.nodeAbi !== undefined) {
    const { from, to } = plan.nodeAbi;
    edit(io, WORKSPACE_YAML, (text) => setNodeAbi(text, from, to));
    await io.install({ frozen: false });
    if (!(await io.abiKnown(plan.electron.to))) {
      throw new Error(`node-abi ${to} does not know Electron ${plan.electron.to}`);
    }
  }

  const nodeChanged = plan.node.from !== plan.node.to;
  edit(io, WORKSPACE_YAML, (text) => setElectron(text, plan.electron.from, plan.electron.to));
  if (nodeChanged) {
    edit(io, PACKAGE_JSON, (text) => setPackageJsonNode(text, plan.node.from, plan.node.to));
  }
  await io.install({ frozen: false });

  if (nodeChanged) {
    edit(io, WORKSPACE_YAML, (text) => setAllowBuildsNode(text, plan.node.from, plan.node.to));
    await io.install({ frozen: false });
  }

  const unexpected = (await io.changedFiles()).filter((file) => !EXPECTED_CHANGES.has(file));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected changes in the working tree: ${unexpected.join(", ")}`);
  }
};
