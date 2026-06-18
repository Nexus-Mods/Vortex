# Pathfinder to GDL Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the two Owlcat Pathfinder game extensions (Kingmaker, Wrath of the Righteous) to run off the Game Description Language (GDL), adding one new declarative GDL feature (`setup.requireFiles`) to cover the Unity Mod Manager prompt.

**Architecture:** Two phases. Phase A adds a `setup.requireFiles` block to the `game-description-language` submodule (parser, validator, codegen, runtime, type stub, tests). Phase B rewrites each Pathfinder extension as a single declarative `game.yaml`, deletes the old imperative source, and bumps the submodule pointer in Vortex.

**Tech Stack:** TypeScript, GDL toolchain (YAML to webpack-bundled Vortex extension), vitest, pnpm workspaces, git submodule.

---

## Design reference

Full design: `docs/superpowers/specs/2026-06-17-pathfinder-gdl-conversion-design.md`.

Settled decisions baked into this plan:

- Both games drop `modtype-umm` integration (`requireExtension`, `ummAddGame`). They become self-contained. WotR loses UMM auto-download and `umm` mod-type activation (accepted regression).
- The UMM presence check is purely path based (no registry).
- The prompt button opens a Nexus mod page (`domain` + `modId`) or a plain `url`. No silent install.
- The `requireFiles` step is informational; it does not reject `setup` (the original Kingmaker `UserCanceled` quirk is dropped).

## Deviations from the spec to confirm with the user

- **No webp conversion.** No webp encoder is installed (`cwebp`/ImageMagick/sharp absent). The plan keeps `gameart.jpg` and references it directly. webp is optional polish, not a functional requirement. The GDL build copies whatever logo filename `game.yaml` names.
- **No `tests: { corpus: nexus }` in the game.yaml.** Both games register zero installers (mods deploy to `Mods/` via Vortex's default), so corpus installer-routing tests have nothing to assert. The `requireFiles` feature is fully unit-tested in the GDL repo instead. Game-side verification is the GDL build succeeding plus produced `dist/` artifacts.

## File structure

**Phase A — `game-description-language` submodule (separate repo, branch off `main`):**

- Modify: `src/parser/ast.ts` — add `requireFiles?` to `SetupNode` and new node interfaces.
- Modify: `src/parser/index.ts` — parse `setup.requireFiles` (new `parseRequireFiles` helper).
- Modify: `src/schema/validator.ts` — field rules for `requireFiles`.
- Modify: `src/types/vortex-api.d.ts` — declare `fs.statAsync` and `api.showDialog`.
- Modify: `src/runtime/vortex-shim.ts` — `RequireFilesSpec` type, trailing `registerGame` param, setup logic, `runRequireFilesCheck` method.
- Modify: `src/codegen/emit.ts` — emit the `requireFiles` literal (build URL from `mod`).
- Test: `tests/require-files.test.ts` — parser, validator, runtime, codegen cases for the feature.

**Phase B — Vortex repo (branch `halgari/pathfinder-to-gdl`, already created):**

- For each of `extensions/games/game-pathfinderkingmaker/` and `extensions/games/game-pathfinderwrathoftherighteous/`:
    - Create: `game.yaml`, `build.mjs`, `vitest.config.ts`, `gameart.jpg` (moved from `assets/`).
    - Rewrite: `package.json`.
    - Delete: `src/index.js` / `src/index.ts`, `assets/` (including unused `umm.png`), `tsconfig.tsbuildinfo`, any old build script.
- Modify: the submodule pointer (Vortex records the new `game-description-language` commit).

---

# Phase A: GDL `setup.requireFiles` feature

All Phase A work happens inside the submodule directory `game-description-language/`. Commands below assume you are `cd`'d into that directory unless stated otherwise.

### Task A0: Create the feature branch in the submodule

- [ ] **Step 1: Branch off main**

Run (from repo root `/c/oss/Vortex`):

```bash
git -C game-description-language fetch origin
git -C game-description-language checkout -B feat/setup-require-files origin/main
```

- [ ] **Step 2: Confirm clean baseline build and tests**

Run:

```bash
cd game-description-language && pnpm install --frozen-lockfile && pnpm build && pnpm test
```

Expected: build succeeds, full suite passes (the baseline ~154 tests green).

---

### Task A1: AST types for `requireFiles`

**Files:**

- Modify: `game-description-language/src/parser/ast.ts:247-251` (the `SetupNode` interface)

- [ ] **Step 1: Extend `SetupNode` and add node types**

Replace the existing `SetupNode` interface (currently):

```ts
export interface SetupNode extends Node {
    kind: "setup";
    ensureDirs: string[]; // path templates, interpolated against context
}
```

with:

```ts
export interface SetupNode extends Node {
    kind: "setup";
    ensureDirs: string[]; // path templates, interpolated against context
    requireFiles?: RequireFilesNode;
}

// Declarative prerequisite check: stat a list of files at setup time and, when
// any are missing, show an informational dialog that points the user at a mod
// page or URL to download the missing prerequisite (e.g. Unity Mod Manager).
export interface RequireFilesNode {
    files: string[]; // path templates, interpolated against context
    prompt: RequireFilesPrompt;
}

export interface RequireFilesPrompt {
    title: string;
    message: string;
    link?: RequireFilesLink;
}

export interface RequireFilesLink {
    label: string; // button text
    target: RequireFilesTarget;
}

export type RequireFilesTarget =
    | { kind: "mod"; domain: string; modId: number }
    | { kind: "url"; url: string };
```

- [ ] **Step 2: Typecheck**

Run: `cd game-description-language && pnpm exec tsc --noEmit`
Expected: PASS (no references yet, types compile).

- [ ] **Step 3: Commit**

```bash
git -C game-description-language add src/parser/ast.ts
git -C game-description-language commit -m "feat(ast): add requireFiles to SetupNode"
```

---

### Task A2: Parse `setup.requireFiles`

**Files:**

- Modify: `game-description-language/src/parser/index.ts` (the `setup` block near line 884, plus a new helper)
- Test: `game-description-language/tests/require-files.test.ts`

- [ ] **Step 1: Write the failing parser test**

Create `game-description-language/tests/require-files.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseYaml } from "../src/parser/index.js";

const YAML = `gdl: 1
game:
  id: g
  name: G
  executable: G.exe
  requiredFiles: [G.exe]
stores:
  steam: "1"
setup:
  ensureDirs:
    - \${installPath}/Mods
  requireFiles:
    files:
      - \${installPath}/UnityModManager/UnityModManager.dll
    prompt:
      title: Action required
      message: Install UMM
      link:
        label: Get UMM
        mod: { domain: site, modId: 21 }
`;

describe("parser: setup.requireFiles", () => {
    it("parses files, prompt, and a mod link target", () => {
        const doc = parseYaml(YAML, "rf.yaml");
        const rf = doc.setup?.requireFiles;
        expect(rf?.files).toEqual(["${installPath}/UnityModManager/UnityModManager.dll"]);
        expect(rf?.prompt.title).toBe("Action required");
        expect(rf?.prompt.message).toBe("Install UMM");
        expect(rf?.prompt.link?.label).toBe("Get UMM");
        expect(rf?.prompt.link?.target).toEqual({ kind: "mod", domain: "site", modId: 21 });
    });

    it("parses a url link target", () => {
        const doc = parseYaml(
            YAML.replace("mod: { domain: site, modId: 21 }", "url: https://example.com/umm"),
            "rf.yaml",
        );
        expect(doc.setup?.requireFiles?.prompt.link?.target).toEqual({
            kind: "url",
            url: "https://example.com/umm",
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game-description-language && pnpm exec vitest run tests/require-files.test.ts`
Expected: FAIL (`rf` is undefined — parser ignores `requireFiles`).

- [ ] **Step 3: Add the import and parse logic**

In `src/parser/index.ts`, add the new AST types to the existing `ast.js` import (find the import line that already pulls `SetupNode` and add the new names):

```ts
import type {
    // ...existing imports...
    SetupNode,
    RequireFilesNode,
    RequireFilesLink,
    RequireFilesTarget,
} from "./ast.js";
```

(Only add the names not already present; `SetupNode` is likely already imported.)

Replace the existing `setup` assembly block (currently building `setup = { kind: 'setup', ensureDirs: dirs, span }`) so it also parses `requireFiles`:

```ts
let requireFiles: RequireFilesNode | undefined;
const rfYaml = setupYaml.get("requireFiles", true);
if (isMap(rfYaml)) {
    requireFiles = parseRequireFiles(rfYaml, file, source);
}
setup = {
    kind: "setup",
    ensureDirs: dirs,
    ...(requireFiles !== undefined && { requireFiles }),
    span: spanOf(file, source, setupYaml),
};
```

Add this helper near the other parse helpers (e.g. just above `parseYaml` or beside `parseToolbarActionTarget`). It mirrors the structural-error style used by the `ensureDirs` parser:

```ts
function parseRequireFiles(node: YAMLMap, file: string, source: string): RequireFilesNode {
    const files: string[] = [];
    const filesYaml = node.get("files", true);
    if (isSeq(filesYaml)) {
        for (const item of filesYaml.items) {
            if (isScalar(item) && typeof item.value === "string") {
                files.push(item.value);
            } else {
                throw new BuildErrors([
                    {
                        code: "GDL153",
                        message: "setup.requireFiles.files entries must be strings",
                        span: spanOf(file, source, item as YamlNode),
                    },
                ]);
            }
        }
    }

    const promptYaml = node.get("prompt", true);
    if (!isMap(promptYaml)) {
        throw new BuildErrors([
            {
                code: "GDL154",
                message: "setup.requireFiles.prompt must be a mapping with title and message",
                span: spanOf(file, source, node),
            },
        ]);
    }
    const title = String(promptYaml.get("title") ?? "");
    const message = String(promptYaml.get("message") ?? "");

    let link: RequireFilesLink | undefined;
    const linkYaml = promptYaml.get("link", true);
    if (isMap(linkYaml)) {
        const label = String(linkYaml.get("label") ?? "");
        const modYaml = linkYaml.get("mod", true);
        const urlYaml = linkYaml.get("url", true);
        let target: RequireFilesTarget;
        if (isMap(modYaml)) {
            target = {
                kind: "mod",
                domain: String(modYaml.get("domain") ?? ""),
                modId: Number(modYaml.get("modId") ?? 0),
            };
        } else if (isScalar(urlYaml) && typeof urlYaml.value === "string") {
            target = { kind: "url", url: urlYaml.value };
        } else {
            throw new BuildErrors([
                {
                    code: "GDL156",
                    message:
                        "setup.requireFiles.prompt.link must set exactly one of `mod` or `url`",
                    span: spanOf(file, source, linkYaml),
                },
            ]);
        }
        link = { label, target };
    }

    return { files, prompt: { title, message, ...(link !== undefined && { link }) } };
}
```

Note: `YAMLMap` and `YamlNode` types are already imported/used elsewhere in this file (see `parseToolbarActionTarget`); reuse the same type names. If `YAMLMap` is not yet imported, use the same `yaml` import the file already relies on.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game-description-language && pnpm exec vitest run tests/require-files.test.ts`
Expected: PASS (both parser cases).

- [ ] **Step 5: Typecheck and commit**

Run: `cd game-description-language && pnpm exec tsc --noEmit`
Expected: PASS.

```bash
git -C game-description-language add src/parser/index.ts tests/require-files.test.ts
git -C game-description-language commit -m "feat(parser): parse setup.requireFiles"
```

---

### Task A3: Validate `requireFiles`

**Files:**

- Modify: `game-description-language/src/schema/validator.ts` (inside the `if (doc.setup)` block, after the `ensureDirs` checks near line 390-399)
- Test: `game-description-language/tests/require-files.test.ts` (append)

- [ ] **Step 1: Write the failing validator tests**

Append to `tests/require-files.test.ts`:

```ts
import { validate } from "../src/schema/validator.js";

const baseYaml = (rf: string) => `gdl: 1
game:
  id: g
  name: G
  executable: G.exe
  requiredFiles: [G.exe]
stores:
  steam: "1"
setup:
  ensureDirs:
    - \${installPath}/Mods
  requireFiles:
${rf}
`;

describe("validator: setup.requireFiles", () => {
    it("accepts a well-formed requireFiles block", () => {
        const doc = parseYaml(
            baseYaml(
                `    files:
      - \${installPath}/x.dll
    prompt:
      title: T
      message: M
      link:
        label: L
        mod: { domain: site, modId: 21 }`,
            ),
            "rf.yaml",
        );
        expect(validate(doc).filter((e) => e.code.startsWith("GDL15"))).toEqual([]);
    });

    it("rejects an empty files list", () => {
        const doc = parseYaml(
            baseYaml(
                `    files: []
    prompt:
      title: T
      message: M`,
            ),
            "rf.yaml",
        );
        expect(validate(doc).some((e) => e.code === "GDL153")).toBe(true);
    });

    it("rejects a missing prompt title", () => {
        const doc = parseYaml(
            baseYaml(
                `    files:
      - \${installPath}/x.dll
    prompt:
      title: ""
      message: M`,
            ),
            "rf.yaml",
        );
        expect(validate(doc).some((e) => e.code === "GDL154")).toBe(true);
    });

    it("rejects a link with an empty mod domain", () => {
        const doc = parseYaml(
            baseYaml(
                `    files:
      - \${installPath}/x.dll
    prompt:
      title: T
      message: M
      link:
        label: L
        mod: { domain: "", modId: 21 }`,
            ),
            "rf.yaml",
        );
        expect(validate(doc).some((e) => e.code === "GDL155")).toBe(true);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd game-description-language && pnpm exec vitest run tests/require-files.test.ts -t "validator: setup.requireFiles"`
Expected: FAIL (no GDL153/154/155 emitted yet).

- [ ] **Step 3: Add validation**

In `src/schema/validator.ts`, inside the existing `if (doc.setup) {` block, after the `ensureDirs` loop, add:

```ts
const rf = doc.setup.requireFiles;
if (rf) {
    if (rf.files.length === 0) {
        errors.push({
            code: "GDL153",
            message: "setup.requireFiles.files must not be empty",
            span: doc.setup.span,
        });
    }
    rf.files.forEach((f, i) => {
        if (f.trim() === "") {
            errors.push({
                code: "GDL153",
                message: `setup.requireFiles.files[${i}] must not be empty`,
                span: doc.setup!.span,
            });
        }
    });
    if (rf.prompt.title.trim() === "") {
        errors.push({
            code: "GDL154",
            message: "setup.requireFiles.prompt.title must not be empty",
            span: doc.setup.span,
        });
    }
    if (rf.prompt.message.trim() === "") {
        errors.push({
            code: "GDL154",
            message: "setup.requireFiles.prompt.message must not be empty",
            span: doc.setup.span,
        });
    }
    if (rf.prompt.link) {
        const link = rf.prompt.link;
        if (link.label.trim() === "") {
            errors.push({
                code: "GDL155",
                message: "setup.requireFiles.prompt.link.label must not be empty",
                span: doc.setup.span,
            });
        }
        if (
            link.target.kind === "mod" &&
            (link.target.domain.trim() === "" ||
                !Number.isFinite(link.target.modId) ||
                link.target.modId <= 0)
        ) {
            errors.push({
                code: "GDL155",
                message: "setup.requireFiles.prompt.link.mod needs a domain and a positive modId",
                span: doc.setup.span,
            });
        }
        if (link.target.kind === "url" && link.target.url.trim() === "") {
            errors.push({
                code: "GDL155",
                message: "setup.requireFiles.prompt.link.url must not be empty",
                span: doc.setup.span,
            });
        }
    }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd game-description-language && pnpm exec vitest run tests/require-files.test.ts`
Expected: PASS (all parser + validator cases).

- [ ] **Step 5: Typecheck and commit**

Run: `cd game-description-language && pnpm exec tsc --noEmit`

```bash
git -C game-description-language add src/schema/validator.ts tests/require-files.test.ts
git -C game-description-language commit -m "feat(validator): enforce setup.requireFiles field rules"
```

---

### Task A4: Extend the `vortex-api` type stub

**Files:**

- Modify: `game-description-language/src/types/vortex-api.d.ts:116-118` (`fs`) and `:93-98` (`api`)

The runtime shim (Task A5) calls `fs.statAsync` and `api.showDialog`, neither of which the stub declares. Add them first so A5 typechecks.

- [ ] **Step 1: Add `fs.statAsync`**

Replace:

```ts
export const fs: {
    ensureDirWritableAsync: (path: string) => Promise<void>;
};
```

with:

```ts
export const fs: {
    ensureDirWritableAsync: (path: string) => Promise<void>;
    statAsync: (path: string) => Promise<{ isDirectory: () => boolean }>;
};
```

- [ ] **Step 2: Add `showDialog` to the context `api` type**

Replace the `api: { ... }` block inside `IExtensionContext` (currently `getState` + `events.on`) with:

```ts
    api: {
      getState: () => unknown;
      events: {
        on: (event: string, handler: (...args: unknown[]) => void) => void;
      };
      showDialog: (
        type: string,
        title: string,
        content: { text?: string; message?: string; bbcode?: string },
        actions: Array<{ label: string; action?: () => void }>,
      ) => Promise<unknown>;
    };
```

- [ ] **Step 3: Typecheck and commit**

Run: `cd game-description-language && pnpm exec tsc --noEmit`
Expected: PASS.

```bash
git -C game-description-language add src/types/vortex-api.d.ts
git -C game-description-language commit -m "feat(types): declare fs.statAsync and api.showDialog in stub"
```

---

### Task A5: Runtime — run the check and show the dialog

**Files:**

- Modify: `game-description-language/src/runtime/vortex-shim.ts` (add type, `registerGame` trailing param, setup logic, helper)
- Test: `game-description-language/tests/require-files.test.ts` (append)

- [ ] **Step 1: Write the failing runtime tests**

Append to `tests/require-files.test.ts`:

```ts
import { GdlRuntime } from "../src/runtime/index.js";
import { createFakeContext } from "../src/runtime/testing/index.js";
import type { IExtensionContext } from "vortex-api";
import { vi } from "vitest";

const RT_DECL = { id: "g", name: "G", executable: "G.exe", requiredFiles: ["G.exe"] };
const RT_STORES = [{ id: "steam", value: "1" }];
const RT_CTX = { bindings: [] };
const RT_MODTYPES: never[] = [];
const RT_RF = {
    files: ["${installPath}/UnityModManager/UnityModManager.dll"],
    prompt: {
        title: "Action required",
        message: "Install UMM",
        link: { label: "Get UMM", url: "https://www.nexusmods.com/site/mods/21" },
    },
};

const dialogMock = (h: ReturnType<typeof createFakeContext>) =>
    (h.context as unknown as { api: { showDialog: ReturnType<typeof vi.fn> } }).api.showDialog;

describe("runtime: setup.requireFiles", () => {
    beforeEach(() => vi.clearAllMocks());

    it("shows the prompt when a required file is missing", async () => {
        const { fs } = await import("vortex-api");
        vi.mocked(fs.statAsync).mockRejectedValue(new Error("ENOENT"));
        const h = createFakeContext();
        const runtime = new GdlRuntime(h.context as IExtensionContext);
        runtime.registerGame(
            RT_DECL,
            RT_STORES,
            RT_CTX,
            RT_MODTYPES,
            [],
            {},
            [],
            [],
            {},
            [],
            RT_RF,
        );
        const g = h.registered.game!;
        await g.setup!({ path: "/games/g", store: "steam" });
        expect(dialogMock(h)).toHaveBeenCalledTimes(1);
        expect(dialogMock(h).mock.calls[0][1]).toBe("Action required");
    });

    it("stays silent when all required files exist", async () => {
        const { fs } = await import("vortex-api");
        vi.mocked(fs.statAsync).mockResolvedValue({ isDirectory: () => false });
        const h = createFakeContext();
        const runtime = new GdlRuntime(h.context as IExtensionContext);
        runtime.registerGame(
            RT_DECL,
            RT_STORES,
            RT_CTX,
            RT_MODTYPES,
            [],
            {},
            [],
            [],
            {},
            [],
            RT_RF,
        );
        await h.registered.game!.setup!({ path: "/games/g", store: "steam" });
        expect(dialogMock(h)).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd game-description-language && pnpm exec vitest run tests/require-files.test.ts -t "runtime: setup.requireFiles"`
Expected: FAIL (`registerGame` ignores the 11th arg; no dialog).

- [ ] **Step 3: Add the `RequireFilesSpec` type**

In `src/runtime/vortex-shim.ts`, near the other exported interfaces (e.g. after `EventHooks`), add:

```ts
export interface RequireFilesSpec {
    files: string[];
    prompt: {
        title: string;
        message: string;
        link?: { label: string; url: string };
    };
}
```

- [ ] **Step 4: Add the trailing `registerGame` parameter**

Extend the `registerGame` signature. After the existing `diagnostics: IModHealthCheck[] = [],` parameter, add:

```ts
    requireFiles?: RequireFilesSpec,
```

- [ ] **Step 5: Run the check inside `game.setup`**

Replace the existing setup block:

```ts
if (setupDirs.length > 0) {
    game.setup = async (discovery: IDiscoveryResult) => {
        const { fs } = await import("vortex-api");
        const facts = this.factsFromDiscovery(discovery);
        this.cachedFacts = facts;
        this.resolvedCtx = resolveContext(contextSpec, facts);
        if (discovery.store) this.discoveredStore = discovery.store;
        for (const tpl of setupDirs) {
            const path = interpolate(tpl, this.resolvedCtx);
            await fs.ensureDirWritableAsync(path);
        }
    };
}
```

with:

```ts
if (setupDirs.length > 0 || requireFiles !== undefined) {
    game.setup = async (discovery: IDiscoveryResult) => {
        const { fs } = await import("vortex-api");
        const facts = this.factsFromDiscovery(discovery);
        this.cachedFacts = facts;
        this.resolvedCtx = resolveContext(contextSpec, facts);
        if (discovery.store) this.discoveredStore = discovery.store;
        for (const tpl of setupDirs) {
            const path = interpolate(tpl, this.resolvedCtx);
            await fs.ensureDirWritableAsync(path);
        }
        if (requireFiles !== undefined) {
            await this.runRequireFilesCheck(requireFiles);
        }
    };
}
```

- [ ] **Step 6: Add the `runRequireFilesCheck` method**

Add this private method to the `GdlRuntime` class (e.g. just below `registerGame`):

```ts
  // Setup-time prerequisite check. Resolve each declared file template against
  // the current context and stat it. If any are missing, show an informational
  // dialog that points the user at a download. Non-fatal: it never rejects setup.
  private async runRequireFilesCheck(spec: RequireFilesSpec): Promise<void> {
    const { fs, util } = await import('vortex-api');
    const ctx = this.resolvedCtx ?? ({} as ResolvedContext);
    const resolved = spec.files.map((tpl) => interpolate(tpl, ctx));
    const present = await Promise.all(
      resolved.map(async (p) => {
        try {
          await fs.statAsync(p);
          return true;
        } catch {
          return false;
        }
      }),
    );
    if (present.every(Boolean)) return;

    const actions: Array<{ label: string; action?: () => void }> = [{ label: 'Close' }];
    if (spec.prompt.link) {
      const { label, url } = spec.prompt.link;
      actions.push({ label, action: () => { void util.opn(url).catch(() => undefined); } });
    }
    void this.api.api.showDialog('info', spec.prompt.title, { text: spec.prompt.message }, actions);
  }
```

Note: `ResolvedContext` and `interpolate` are already imported at the top of this file.

- [ ] **Step 7: Run to verify pass**

Run: `cd game-description-language && pnpm exec vitest run tests/require-files.test.ts`
Expected: PASS (parser + validator + runtime).

- [ ] **Step 8: Typecheck and commit**

Run: `cd game-description-language && pnpm exec tsc --noEmit`
Expected: PASS.

```bash
git -C game-description-language add src/runtime/vortex-shim.ts tests/require-files.test.ts
git -C game-description-language commit -m "feat(runtime): stat requireFiles and show download prompt in setup"
```

---

### Task A6: Codegen — emit the `requireFiles` literal

**Files:**

- Modify: `game-description-language/src/codegen/emit.ts` (build a literal near line 149; pass it as the 11th `registerGame` arg near line 264-267)
- Test: `game-description-language/tests/require-files.test.ts` (append)

- [ ] **Step 1: Write the failing codegen tests**

Append to `tests/require-files.test.ts`:

```ts
import { emit } from "../src/codegen/emit.js";

describe("codegen: setup.requireFiles", () => {
    const extOf = (yaml: string) => {
        const doc = parseYaml(yaml, "rf.yaml");
        return emit(doc).find((f) => f.path.endsWith("extension.ts"))!.contents;
    };

    it("builds a nexus mod page URL from a mod target", () => {
        const ext = extOf(
            baseYaml(
                `    files:
      - \${installPath}/x.dll
    prompt:
      title: Action required
      message: Install UMM
      link:
        label: Get UMM
        mod: { domain: site, modId: 21 }`,
            ),
        );
        expect(ext).toContain("'https://www.nexusmods.com/site/mods/21'");
        expect(ext).toContain("Action required");
    });

    it("passes a url target through unchanged", () => {
        const ext = extOf(
            baseYaml(
                `    files:
      - \${installPath}/x.dll
    prompt:
      title: T
      message: M
      link:
        label: L
        url: https://example.com/umm`,
            ),
        );
        expect(ext).toContain("'https://example.com/umm'");
    });

    it("emits undefined when no requireFiles is declared", () => {
        const ext = extOf(`gdl: 1
game:
  id: g
  name: G
  executable: G.exe
  requiredFiles: [G.exe]
stores:
  steam: "1"
setup:
  ensureDirs:
    - \${installPath}/Mods`);
        // The 11th registerGame argument is the requireFiles literal.
        expect(ext).toMatch(/\],\s*undefined,\s*\);/);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd game-description-language && pnpm exec vitest run tests/require-files.test.ts -t "codegen: setup.requireFiles"`
Expected: FAIL (no requireFiles arg emitted).

- [ ] **Step 3: Build the literal**

In `src/codegen/emit.ts`, after the `setupDirsLines` definition (around line 151), add:

```ts
const requireFilesLit = (() => {
    const rf = doc.setup?.requireFiles;
    if (!rf) return "undefined";
    const filesLit = `[${rf.files.map(sq).join(", ")}]`;
    let linkLit = "";
    if (rf.prompt.link) {
        const t = rf.prompt.link.target;
        const url =
            t.kind === "url" ? t.url : `https://www.nexusmods.com/${t.domain}/mods/${t.modId}`;
        linkLit = `, link: { label: ${sq(rf.prompt.link.label)}, url: ${sq(url)} }`;
    }
    return `{ files: ${filesLit}, prompt: { title: ${sq(rf.prompt.title)}, message: ${sq(rf.prompt.message)}${linkLit} } }`;
})();
```

- [ ] **Step 4: Pass it as the 11th `registerGame` argument**

In the `extension` template string, the `registerGame(...)` call currently ends with the diagnostics array:

```ts
    [
${diagnosticsLines}
    ],
  );
```

Change it to append the literal:

```ts
    [
${diagnosticsLines}
    ],
    ${requireFilesLit},
  );
```

- [ ] **Step 5: Run to verify pass**

Run: `cd game-description-language && pnpm exec vitest run tests/require-files.test.ts`
Expected: PASS (all parser + validator + runtime + codegen cases).

- [ ] **Step 6: Typecheck and commit**

Run: `cd game-description-language && pnpm exec tsc --noEmit`

```bash
git -C game-description-language add src/codegen/emit.ts tests/require-files.test.ts
git -C game-description-language commit -m "feat(codegen): emit setup.requireFiles into registerGame call"
```

---

### Task A7: Rebuild GDL dist and run the full suite

**Files:** none (build + verify)

- [ ] **Step 1: Full test suite**

Run: `cd game-description-language && pnpm test`
Expected: PASS (baseline suite plus the new `require-files.test.ts` cases). No regressions.

- [ ] **Step 2: Rebuild the toolchain dist**

The Vortex game build reuses `game-description-language/dist` and only rebuilds it when `dist/cli.js` is absent. Rebuild it now so Phase B compiles against the new feature:

```bash
cd game-description-language && pnpm build
```

Expected: build succeeds; `dist/cli.js`, `dist/commands/build.js` regenerated.

- [ ] **Step 3: Confirm the branch is clean**

Run: `git -C game-description-language status --porcelain`
Expected: empty (all feature changes committed; `dist/` is git-ignored in the submodule, confirm with `git -C game-description-language status` that no unexpected files are staged).

---

# Phase B: Convert the two Pathfinder extensions

All Phase B work is in the Vortex repo on branch `halgari/pathfinder-to-gdl` (already checked out). Run commands from `/c/oss/Vortex`.

### Task B1: Convert Pathfinder: Kingmaker

**Files:**

- Create: `extensions/games/game-pathfinderkingmaker/game.yaml`
- Create: `extensions/games/game-pathfinderkingmaker/build.mjs`
- Create: `extensions/games/game-pathfinderkingmaker/vitest.config.ts`
- Rewrite: `extensions/games/game-pathfinderkingmaker/package.json`
- Move: `assets/gameart.jpg` to `gameart.jpg` (extension root)
- Delete: `src/index.js`, `assets/` (with `umm.png`), `tsconfig.tsbuildinfo`

- [ ] **Step 1: Move the logo to the extension root and remove old files**

Run:

```bash
cd /c/oss/Vortex/extensions/games/game-pathfinderkingmaker
git mv assets/gameart.jpg gameart.jpg
git rm src/index.js assets/umm.png tsconfig.tsbuildinfo
rmdir assets 2>/dev/null || true
```

Expected: `gameart.jpg` now at the extension root; `src/`, `assets/` gone.

- [ ] **Step 2: Write `game.yaml`**

Create `extensions/games/game-pathfinderkingmaker/game.yaml`:

```yaml
gdl: 1
version: 0.2.0

game:
    id: pathfinderkingmaker
    name: "Pathfinder: Kingmaker"
    executable: Kingmaker.exe
    requiredFiles: [Kingmaker.exe]
    logo: gameart.jpg
    author: m0nster
    nexusDomain: pathfinderkingmaker
    # All Kingmaker mods deploy under the game's Mods folder (Unity Mod Manager).
    queryModPath: Mods

stores:
    steam: "640820"

setup:
    ensureDirs:
        - ${installPath}/Mods
    requireFiles:
        files:
            - ${installPath}/UnityModManager/UnityModManager.dll
        prompt:
            title: Action required
            message: >-
                You must install Unity Mod Manager to use mods with Pathfinder: Kingmaker.
            link:
                label: Go to the Unity Mod Manager page
                mod: { domain: site, modId: 21 }
```

- [ ] **Step 3: Write `build.mjs`**

Create `extensions/games/game-pathfinderkingmaker/build.mjs` (identical to the X Rebirth GDL build entry):

```js
import * as path from "node:path";

import { buildGdlExtension } from "../../../scripts/build-gdl-extension.mjs";

// This extension is described declaratively in game.yaml and compiled by the
// Game Description Language (GDL) toolchain into a Vortex-loadable dist/index.js.
await buildGdlExtension(path.resolve(import.meta.dirname));
```

- [ ] **Step 4: Write `vitest.config.ts`**

Create `extensions/games/game-pathfinderkingmaker/vitest.config.ts` (copied from X Rebirth so `pnpm test` runs cleanly even with no local tests):

```ts
import { createRequire } from "node:module";

import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../../vitest.base.config";

const require_ = createRequire(import.meta.url);
const VORTEX_API_MOCK = require_.resolve("@vortex/extension-test-mocks");

export default mergeConfig(
    baseConfig,
    defineConfig({
        resolve: {
            alias: [{ find: /^@nexusmods\/vortex-api$/, replacement: VORTEX_API_MOCK }],
        },
        test: {
            environment: "node",
            include: ["src/**/*.test.ts"],
        },
    }),
);
```

- [ ] **Step 5: Rewrite `package.json`**

Overwrite `extensions/games/game-pathfinderkingmaker/package.json`:

```json
{
    "name": "game-pathfinderkingmaker",
    "version": "0.2.0",
    "description": "Support for Pathfinder: Kingmaker",
    "scripts": {
        "build": "node build.mjs",
        "test": "pnpm exec vitest run --passWithNoTests"
    },
    "author": "m0nster",
    "license": "GPL-3.0",
    "type": "commonjs",
    "private": true,
    "config": {
        "game": "Pathfinder: Kingmaker"
    },
    "devDependencies": {
        "@nexusmods/vortex-api": "workspace:*",
        "@vortex/extension-test-mocks": "workspace:*"
    },
    "nx": {
        "tags": ["vortex:extension"],
        "targets": {
            "build": {
                "inputs": ["default", "typescript", "vortex-api"]
            }
        }
    }
}
```

- [ ] **Step 6: Install workspace deps (new devDependency added)**

Run (from `/c/oss/Vortex`): `pnpm install`
Expected: succeeds; links `@vortex/extension-test-mocks` into the package.

- [ ] **Step 7: Build the extension**

Run: `pnpm --filter game-pathfinderkingmaker run build`
Expected: GDL compiles `game.yaml`. Output: `dist/index.js`, `dist/index.js.map`, `dist/info.json`, `dist/gameart.jpg`.

- [ ] **Step 8: Verify the build output**

Run:

```bash
ls extensions/games/game-pathfinderkingmaker/dist/
cat extensions/games/game-pathfinderkingmaker/dist/info.json
grep -c "https://www.nexusmods.com/site/mods/21" extensions/games/game-pathfinderkingmaker/dist/index.js
```

Expected: `dist/` contains `index.js`, `info.json`, `gameart.jpg`; `info.json` has `id`/`name`/`version 0.2.0`; the grep prints `1` (the UMM page URL is baked into the bundle).

- [ ] **Step 9: Run test + lint + format for the package**

Run:

```bash
pnpm --filter game-pathfinderkingmaker run test
pnpm exec eslint extensions/games/game-pathfinderkingmaker --max-warnings 0 || true
pnpm exec oxfmt extensions/games/game-pathfinderkingmaker
```

Expected: test passes with no test files (`--passWithNoTests`). Resolve any lint errors GDL extensions are expected to satisfy (the `|| true` is only to surface output; fix real errors).

- [ ] **Step 10: Commit**

```bash
cd /c/oss/Vortex
git add extensions/games/game-pathfinderkingmaker/
git commit -m "Convert Pathfinder: Kingmaker extension to GDL

Replace the imperative index.js with a declarative game.yaml. Drop the
modtype-umm dependency, registry probe, Bluebird, and platform guards.
UMM presence is checked via the new setup.requireFiles block, which prompts
the user to the Unity Mod Manager page when the loader is absent."
```

---

### Task B2: Convert Pathfinder: Wrath of the Righteous

**Files:**

- Create: `extensions/games/game-pathfinderwrathoftherighteous/game.yaml`
- Create: `extensions/games/game-pathfinderwrathoftherighteous/vitest.config.ts`
- Rewrite: `extensions/games/game-pathfinderwrathoftherighteous/build.mjs`, `package.json`
- Move: `assets/gameart.jpg` to `gameart.jpg`
- Delete: `src/index.ts`, `assets/` (with `umm.png`)

- [ ] **Step 1: Move the logo and remove old files**

Run:

```bash
cd /c/oss/Vortex/extensions/games/game-pathfinderwrathoftherighteous
git mv assets/gameart.jpg gameart.jpg
git rm src/index.ts assets/umm.png
rmdir assets 2>/dev/null || true
```

- [ ] **Step 2: Write `game.yaml`**

Create `extensions/games/game-pathfinderwrathoftherighteous/game.yaml`:

```yaml
gdl: 1
version: 1.0.1

game:
    id: pathfinderwrathoftherighteous
    name: "Pathfinder: Wrath of the Righteous"
    executable: Wrath.exe
    requiredFiles: [Wrath.exe]
    logo: gameart.jpg
    author: Black Tree Gaming Ltd.
    nexusDomain: pathfinderwrathoftherighteous
    queryModPath: Mods

stores:
    steam: "1184370"
    gog: "1207187357"

# Reads the build version from Version.info. The original extension split the
# file on spaces and took the 4th token; the regex captures that same token.
discovery:
    version:
        file: ${installPath}/Wrath_Data/StreamingAssets/Version.info
        regex: '^(?:\S+\s+){3}(\S+)'

setup:
    ensureDirs:
        - ${installPath}/Mods
    requireFiles:
        files:
            - ${installPath}/UnityModManager/UnityModManager.dll
        prompt:
            title: Action required
            message: >-
                You must install Unity Mod Manager to use mods with Pathfinder: Wrath of
                the Righteous.
            link:
                label: Go to the Unity Mod Manager page
                mod: { domain: site, modId: 21 }
```

- [ ] **Step 3: Overwrite `build.mjs`**

Replace `extensions/games/game-pathfinderwrathoftherighteous/build.mjs` with the GDL build entry:

```js
import * as path from "node:path";

import { buildGdlExtension } from "../../../scripts/build-gdl-extension.mjs";

// This extension is described declaratively in game.yaml and compiled by the
// Game Description Language (GDL) toolchain into a Vortex-loadable dist/index.js.
await buildGdlExtension(path.resolve(import.meta.dirname));
```

- [ ] **Step 4: Write `vitest.config.ts`**

Create `extensions/games/game-pathfinderwrathoftherighteous/vitest.config.ts` with the same contents as Task B1 Step 4.

- [ ] **Step 5: Rewrite `package.json`**

Overwrite `extensions/games/game-pathfinderwrathoftherighteous/package.json`:

```json
{
    "name": "game-pathfinderwrathoftherighteous",
    "version": "1.0.1",
    "description": "Support for Pathfinder: Wrath of the Righteous",
    "scripts": {
        "build": "node build.mjs",
        "test": "pnpm exec vitest run --passWithNoTests"
    },
    "author": "Black Tree Gaming Ltd.",
    "license": "GPL-3.0",
    "type": "commonjs",
    "private": true,
    "config": {
        "game": "Pathfinder: Wrath of the Righteous"
    },
    "devDependencies": {
        "@nexusmods/vortex-api": "workspace:*",
        "@vortex/extension-test-mocks": "workspace:*"
    },
    "nx": {
        "tags": ["vortex:extension"],
        "targets": {
            "build": {
                "inputs": ["default", "typescript", "vortex-api"]
            }
        }
    }
}
```

- [ ] **Step 6: Install, build, verify**

Run (from `/c/oss/Vortex`):

```bash
pnpm install
pnpm --filter game-pathfinderwrathoftherighteous run build
ls extensions/games/game-pathfinderwrathoftherighteous/dist/
cat extensions/games/game-pathfinderwrathoftherighteous/dist/info.json
grep -c "https://www.nexusmods.com/site/mods/21" extensions/games/game-pathfinderwrathoftherighteous/dist/index.js
```

Expected: `dist/index.js`, `dist/info.json` (version `1.0.1`), `dist/gameart.jpg`; grep prints `1`. Confirm the bundle also references `Version.info` (the version regex): `grep -c "Version.info" .../dist/index.js` prints `1`.

- [ ] **Step 7: Test + lint + format**

Run:

```bash
pnpm --filter game-pathfinderwrathoftherighteous run test
pnpm exec oxfmt extensions/games/game-pathfinderwrathoftherighteous
```

Expected: test passes (`--passWithNoTests`); format clean.

- [ ] **Step 8: Commit**

```bash
git add extensions/games/game-pathfinderwrathoftherighteous/
git commit -m "Convert Pathfinder: Wrath of the Righteous extension to GDL

Replace the imperative index.ts with a declarative game.yaml. Drop the
modtype-umm/ummAddGame integration, move version detection to a declarative
discovery.version (Version.info) block, and add the setup.requireFiles UMM
prompt. WotR no longer auto-downloads UMM (accepted regression)."
```

---

### Task B3: Bump the submodule pointer and final verification

**Files:**

- Modify: the `game-description-language` submodule gitlink (Vortex records the new commit)

- [ ] **Step 1: Stage the submodule pointer**

The Vortex working tree now sees `game-description-language` at the new `feat/setup-require-files` commit. Stage it:

```bash
cd /c/oss/Vortex
git add game-description-language
git status
```

Expected: `game-description-language` shows as a modified submodule (new commit).

- [ ] **Step 2: Rebuild both games against the bumped submodule from a clean dist**

Run:

```bash
rm -rf extensions/games/game-pathfinderkingmaker/dist extensions/games/game-pathfinderwrathoftherighteous/dist
pnpm --filter game-pathfinderkingmaker run build
pnpm --filter game-pathfinderwrathoftherighteous run build
```

Expected: both build cleanly against the current submodule dist.

- [ ] **Step 3: Commit the submodule bump**

```bash
git commit -m "chore: bump game-description-language submodule for setup.requireFiles"
```

- [ ] **Step 4: Final affected-package checks**

Run:

```bash
pnpm --filter game-pathfinderkingmaker run test
pnpm --filter game-pathfinderwrathoftherighteous run test
pnpm exec oxfmt extensions/games/game-pathfinderkingmaker extensions/games/game-pathfinderwrathoftherighteous
```

Expected: all green.

- [ ] **Step 5: Independent review (recommended)**

Spawn a review subagent (clean context, sonnet) to verify each `game.yaml` is a faithful replacement of the original discovery paths (Steam/GOG ids, exe, Mods path, WotR version source) and that the dropped behaviors match the approved design. Fix anything it surfaces before opening a PR.

---

## Notes for the implementer

- The GDL feature lives in a separate repo (`Nexus-Mods/game-description-language`). Pushing `feat/setup-require-files` and opening its PR is a separate step from this plan; the Vortex branch only records the submodule commit. Do not push or open PRs unless asked.
- `buildGdlExtension` caches the submodule build. If a game build ever picks up stale GDL behavior, rebuild the submodule dist: `cd game-description-language && pnpm build`.
- The UMM marker path `${installPath}/UnityModManager/UnityModManager.dll` is a best-effort path-based check. Verify it against a real UMM-patched Pathfinder install; the value is a one-line `game.yaml` edit.
- Keep `game.yaml`'s `version:` in sync with `package.json`. The build steps assert the emitted `info.json` version (0.2.0 / 1.0.1); if it comes out as `0.0.0`, trace how `build.ts` sources `extensionVersion` and adjust (mirror what X Rebirth does, which sets both).
