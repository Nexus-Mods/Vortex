---
phase: 2
slug: winapi-bindings-shim
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 (main/shared) + jest 29.7.0 (renderer) |
| **Config file** | `vitest.config.ts` / `src/renderer/jest.config.mjs` |
| **Quick run command** | `pnpm run test --reporter=verbose 2>&1 | head -60` |
| **Full suite command** | `pnpm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run test --reporter=verbose 2>&1 | head -60`
- **After every plan wave:** Run `pnpm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | WAPI-01 | unit | `pnpm run test -- --testPathPattern winapi-shim` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | WAPI-02 | unit | `pnpm run test -- --testPathPattern winapi-shim` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | WAPI-03 | unit | `pnpm run test -- --testPathPattern winapi-shim` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | WAPI-04 | unit | `pnpm run test -- --testPathPattern winapi-shim` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | WAPI-05 | unit | `pnpm run test -- --testPathPattern winapi-shim` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | WAPI-01 | build | `pnpm run build 2>&1 | tail -5` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | WAPI-01 | build | `pnpm run build 2>&1 | grep -i "error\|winapi" | head -10` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/renderer/src/util/__tests__/winapi-shim.test.ts` — unit tests for all shim exports (WAPI-01 through WAPI-05)

*All test files for the new shim must be created before the shim implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Electron window appears on Linux | WAPI-01 | Requires running Electron on Linux desktop | Run `pnpm run start` on Linux; verify window opens without MODULE_NOT_FOUND crash |
| firststeps_dashlet disk free shows real value | WAPI-02 | Requires running app with display | Open app on Linux; check first-run dashboard shows non-zero disk free space |
| GetVolumePathName returns mount point | WAPI-03 | Requires running app on Linux filesystem | Open app on Linux; verify no error from volume path functions |
| Windows build unaffected | WAPI-01 | Requires Windows CI | Run GitHub Actions CI on Windows; verify green |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
