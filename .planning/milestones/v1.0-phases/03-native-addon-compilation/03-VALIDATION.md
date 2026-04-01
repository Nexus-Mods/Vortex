---
phase: 3
slug: native-addon-compilation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell / CI commands (no unit test framework — compilation and load verification) |
| **Config file** | `.github/workflows/main.yml` |
| **Quick run command** | `node -e "require('./node_modules/bsatk')"` (per addon) |
| **Full suite command** | `npx @electron/rebuild -f -v 39.8.0 && node scripts/verify-addons.js` |
| **Estimated runtime** | ~120 seconds (rebuild) + ~5 seconds (load check) |

---

## Sampling Rate

- **After every task commit:** Verify the specific addon `.node` file exists and loads (`require()`)
- **After every plan wave:** Run full `@electron/rebuild` + addon load check script
- **Before `/gsd:verify-work`:** All five NADD addons load without error; CI green on ubuntu-latest
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| libloot-build | 01 | 1 | NADD-03 | build | `ls node_modules/loot/loot_api/libloot.so` | ❌ W0 | ⬜ pending |
| loot-rebuild | 01 | 2 | NADD-03 | build | `ls node_modules/loot/build/Release/loot.node` | ❌ W0 | ⬜ pending |
| bsatk-rebuild | 02 | 1 | NADD-01 | build | `node -e "require('./node_modules/bsatk')"` | ✅ | ⬜ pending |
| esptk-rebuild | 02 | 1 | NADD-02 | build | `node -e "require('./node_modules/esptk')"` | ✅ | ⬜ pending |
| bsdiff-rebuild | 02 | 1 | NADD-04 | build | `node -e "require('./node_modules/bsdiff-node')"` | ✅ | ⬜ pending |
| xxhash-verify | 02 | 1 | NADD-05 | load | `node -e "require('./node_modules/xxhash-addon')"` | ✅ | ⬜ pending |
| vortexmt-ci | 03 | 1 | NADD-06 | build | `ls node_modules/vortexmt/build/Release/vortexmt.node` | ✅ | ⬜ pending |
| gamebryo-audit | 03 | 1 | NADD-06 | build/skip | documented in audit result | ✅ | ⬜ pending |
| ci-matrix | 04 | 2 | NADD-01..06 | CI | GitHub Actions ubuntu-latest green | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-addons.js` — Node script that requires all five NADD addons and exits non-zero if any fail to load
- [ ] CI: `ubuntu-latest` job has `@electron/rebuild` step (added in plan execution)

*Wave 0 is lightweight — existing addons already compiled locally; CI step is the main deliverable.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App loads addons at runtime without console error | NADD-01..05 | Requires running Electron app | `pnpm run start` on Linux, check DevTools console for native binding errors |
| RPATH correct for libloot.so runtime discovery | NADD-03 | Requires `ldd` on built loot.node | `ldd node_modules/loot/build/Release/loot.node` — verify libloot.so resolved |
| gamebryo-savegame audit documented | NADD-06 | Human decision required | Read audit result in plan execution; confirm disabled or enabled in CI |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
