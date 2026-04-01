---
phase: 5
slug: ipc-and-elevation-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `src/renderer/vitest.config.mts` |
| **Quick run command** | `pnpm -F @vortex/renderer vitest run src/renderer/src/util/ipc.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds (unit); ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm -F @vortex/renderer vitest run src/renderer/src/util/ipc.test.ts`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds (unit), 60 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | IPC-01 | unit | `pnpm -F @vortex/renderer vitest run src/renderer/src/util/ipc.test.ts` | ❌ Wave 0 | ⬜ pending |
| 5-01-02 | 01 | 1 | IPC-02 | manual smoke | `pnpm run start` on Linux + attempt mod deployment | ❌ manual only | ⬜ pending |
| 5-01-03 | 01 | 1 | IPC-03 | manual smoke | Same as IPC-02 (child process path) | ❌ manual only | ⬜ pending |
| 5-02-01 | 02 | 1 | IPC-04 | manual verification | Read audit doc; confirm it answers scope questions | ❌ Wave 0 (doc) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/renderer/src/util/ipc.test.ts` — unit tests for `getIPCPath()` covering IPC-01 (Windows + Linux branches)
- [ ] IPC-04 audit document — written as markdown in phase SUMMARY.md or standalone doc

*IPC-02 and IPC-03 require a live Linux Electron process with mod deployment — no automated unit test is feasible in current test infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parent server `.listen()` uses platform-correct path | IPC-02 | Requires live Linux Electron process with mod deployment | Launch `pnpm run start` on Linux; attempt a mod deployment; observe no IPC connection errors in logs |
| Serialized child closure connects to Unix socket | IPC-03 | Requires live Linux process; child code executed out-of-process | Same as IPC-02; confirm elevated process connects successfully |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
