# Phase 3: Native Addon Compilation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 03-native-addon-compilation
**Areas discussed:** loot Linux strategy

---

## Gray Areas Presented

| Area | Selected |
|------|----------|
| loot Linux strategy | ✓ |
| gamebryo-savegame outcome | |
| Rebuild mechanism | |
| CI structure | |

---

## loot Linux strategy

### Q1: How should we get loot working on Linux?

| Option | Description | Selected |
|--------|-------------|----------|
| Add Linux libloot to the npm package | Compile or download libloot.so and place in loot_api/ | ✓ |
| Stub loot on Linux for now | No-op module, load order won't work on Linux | |
| Download libloot prebuilt in CI | wget in CI step before rebuild, no package changes | |

**User's choice:** Add Linux libloot to the npm package (full implementation)

---

### Q2: Where does the libloot Linux build come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Prebuilt from LOOT GitHub releases | Download published libloot.so artifact, version-pinned | ✓ |
| Compile libloot from source | CMake build step in CI | |

**User's choice:** Prebuilt from LOOT GitHub releases

---

### Q3: Where/how is libloot.so delivered into the node-loot package?

| Option | Description | Selected |
|--------|-------------|----------|
| Patch-package or postinstall script | Drop libloot.so into node_modules/loot/loot_api/ post-install | ✓ |
| Fork node-loot and add to the repo | New Nexus-Mods fork with Linux .so committed | |

**User's choice:** Patch-package or postinstall script (no fork required)

---

## Claude's Discretion

- Rebuild mechanism (@electron/rebuild setup details)
- CI structure (apt packages, step ordering, failure handling)
- gamebryo-savegame investigation approach (NADD-06 audit)
- vortexmt audit approach (NADD-06 audit)

## Deferred Ideas

- Fork node-loot upstream with Linux support — noted for future, not Phase 3
