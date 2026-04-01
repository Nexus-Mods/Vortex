# Phase 6: Steam/Proton Detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 06-steam-proton-detection
**Areas discussed:** mygames path fix (STAM-04), Dual Steam install scan (STAM-02), Never-launched game detection (STAM-03), STAM-05 Fallout 4 scope

---

## mygames path fix (STAM-04)

### iniFiles() signature

| Option | Description | Selected |
|--------|-------------|----------|
| Make iniFiles() async | Returns Promise<string[]>; 4 call sites in ini_prep/index.ts are already PromiseBB chains | ✓ |
| Thread ISteamEntry through IDiscoveryResult | Add optional steamEntry field to IDiscoveryResult; keeps callers sync | |
| Pre-compute at game discovery time | Store mygames path in state at discovery; iniFiles() reads synchronously | |

**User's choice:** Make iniFiles() async
**Notes:** Callers are already in async chains; async is cleanest.

---

### Fallback when compatDataPath unavailable

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to ~/Documents/My Games | Same as Windows behavior; consistent | ✓ |
| Return undefined, skip INI files | Game appears broken until first launch | |
| Construct path optimistically | Return path even if directory doesn't exist; callers handle missing files | |

**User's choice:** Fall back to ~/Documents/My Games
**Notes:** Never-launched games get the fallback; STAM-03 separately handles pre-populating the Proton path.

---

## Dual Steam install scan (STAM-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Deduplicate by appid | Scan all roots, keep first occurrence per appid; user sees each game once | ✓ |
| Show all instances | Two entries for same game — one native, one Flatpak | |

**User's choice:** Deduplicate by appid
**Notes:** Consistent with Steam's own presentation.

---

## Never-launched game detection (STAM-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Return usesProton:true with pre-populated path | oslist doesn't include "linux" → will use Proton; return compatDataPath even if not yet created | ✓ |
| Return usesProton:false, wait for first launch | Only mark Proton after compatdata/ is created | |

**User's choice:** Return usesProton:true with pre-populated path
**Notes:** Lets Vortex set up the game pre-launch; protonPath may still be undefined if no Proton version installed.

---

## STAM-05 Fallout 4 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + fix in Phase 6 if broken | Verify webpack alias scope; fix if it doesn't reach bundled extensions | ✓ |
| Audit only, defer fix | Document the problem; leave Fallout 4 broken on Linux for v2.0 | |

**User's choice:** Audit + fix in Phase 6 if broken
**Notes:** Fallout 4 is a top-4 title; must work for v2.0.

---

## Claude's Discretion

- Whether `findAllLinuxSteamPaths()` is a new function or an extension of the existing one
- Exact threading mechanism for steamEntry into async `iniFiles()`
- Unit test scope for `getMyGamesPath()`
- Precise `oslist` multi-value check logic

## Deferred Ideas

- Cyberpunk native Linux binary detection (beyond STAM-05 audit)
- SMAPI Linux installer end-to-end validation for Stardew Valley
