---
phase: 1
slug: runtime-environment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `src/main/vitest.config.ts` (included in root `vitest.config.ts` projects array) |
| **Quick run command** | `pnpm vitest run --project @vortex/main` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --project @vortex/main`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | RENV-02 | unit (Wave 0 setup) | `pnpm vitest run --project @vortex/main src/main/src/getVortexPath.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | RENV-01 | manual smoke | `docker build -f docker/linux/Dockerfile.devcontainer .` | N/A | ⬜ pending |
| 1-01-03 | 01 | 1 | RENV-02 | unit | `pnpm vitest run --project @vortex/main src/main/src/getVortexPath.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | RENV-03 | manual smoke | `pnpm exec electron-builder --linux --dir` (in devcontainer) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/src/getVortexPath.test.ts` — unit tests for `localAppData()` Linux branch (RENV-02); must mock `process.platform`, `process.env.XDG_DATA_HOME`, and `os.homedir()`
- [ ] No shared fixture file needed — existing Vitest setup in `src/main/vitest.config.ts` is sufficient

*Wave 0 must complete before Wave 1 tasks execute.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dockerfile adds correct Electron runtime libs | RENV-01 | Docker build required; no Jest/Vitest hook for Dockerfile validation | `docker build -f docker/linux/Dockerfile.devcontainer .` in repo root; confirm exits 0 |
| electron-builder dry-run passes on Linux | RENV-03 | Requires Linux host with devcontainer or CI runner | `pnpm exec electron-builder --linux --dir` in devcontainer; confirm no ENOENT for `.exe` resources |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
