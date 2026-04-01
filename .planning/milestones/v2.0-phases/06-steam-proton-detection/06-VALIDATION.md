---
phase: 6
slug: steam-proton-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm run test --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `pnpm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run test --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `pnpm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | STAM-01 | unit | `pnpm run test -- proton` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | STAM-02 | unit | `pnpm run test -- proton` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | STAM-03 | unit | `pnpm run test -- proton` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 2 | STAM-04 | unit | `pnpm run test -- gameSupport` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 2 | STAM-04 | unit | `pnpm run test -- ini_prep` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | STAM-05 | integration | `pnpm run test -- stardew cyberpunk` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/local-gamesettings/src/util/proton.test.ts` — stubs for STAM-01, STAM-02, STAM-03
- [ ] `extensions/local-gamesettings/src/util/gameSupport.test.ts` — stubs for STAM-04 (local-gamesettings)
- [ ] `src/extensions/ini_prep/__tests__/gameSupport.test.ts` — stubs for STAM-04 (ini_prep)

*Existing infrastructure covers test runners — Wave 0 adds test files only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dual Steam install detection (native + Flatpak) | STAM-01 | Requires real Steam installation | Install both native and Flatpak Steam; launch Vortex; verify both paths detected |
| Proton prefix resolves for unplaunched game | STAM-02 | Requires real Steam with untouched game | Check ACF manifest `oslist` for game never launched; verify prefix path returned |
| Skyrim SE INI found in Wine prefix | STAM-04 | Requires installed game | Launch Vortex; activate Skyrim SE; verify INI path points to `compatdata/.../steamuser/Documents/My Games` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
