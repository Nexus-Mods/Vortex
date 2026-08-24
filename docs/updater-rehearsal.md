# Updater Rehearsal on Real GitHub

The mock feed (`docs/updater-testing.md`) covers most of the updater matrix
offline. What it can't cover is GitHub itself: real API shapes and rate
limits, the `objects.githubusercontent.com` redirect on asset downloads,
prerelease and draft semantics, and Authenticode verification against
CI-signed installers. This rehearsal covers those with a packaged Vortex
pointed at a scratch repo. It never touches `Nexus-Mods/Vortex` or
`Nexus-Mods/Vortex-Staging` releases that users can see.

Run it before the first production release of a new updater build, and
again whenever the resolver, the CI packaging action, or `electron-updater`
changes.

## What you need

- `gh` authenticated with write access to the Nexus-Mods org
- A public scratch repo. `Nexus-Mods/vortex-updater-e2e` exists for this;
  reuse it. It must be public because the updater resolves releases
  unauthenticated. If you create a fresh one, seed it with a commit first:
  GitHub can't create a release (it needs a tag) on an empty repo.
- A Windows machine you're happy to install throwaway Vortex builds on.
  The rehearsal replaces whatever Vortex is in `C:\Program Files\Vortex`.
  Reinstall production afterwards.

## 1. Build signed fixtures

Dispatch `.github/workflows/package.yml` once per version, on the branch you
want to test. Inputs:

| input            | value                                         |
| ---------------- | --------------------------------------------- |
| version          | `v9.0.0`, then `v9.0.1`, then `v9.1.0-beta.1` |
| create-artifacts | true                                          |
| use-codesigning  | true                                          |
| release          | **false**                                     |
| staging-release  | true                                          |
| upload-to-r2     | **false**                                     |

```
for v in v9.0.0 v9.0.1 v9.1.0-beta.1; do
  gh workflow run package.yml --ref <branch> -f version=$v -f create-artifacts=true \
    -f use-codesigning=true -f release=false -f staging-release=true -f upload-to-r2=false
done
```

Version numbers are arbitrary, but keep them far above anything real so
they can't be confused with a shipping release. `9.x` works. Three builds
run in parallel and take about 30 minutes.

Each run parks a draft release on Vortex-Staging. Drafts are invisible to
unauthenticated clients, so nothing has been published yet. Check them:

```
gh release view v9.0.0 --repo Nexus-Mods/Vortex-Staging --json isDraft,isPrerelease,assets
```

You want `isDraft: true`, three assets (`.exe`, `.exe.blockmap`,
`latest.yml`), and `isPrerelease` true only for the beta. That last check is
the CI prerelease derivation working.

## 2. Publish to the scratch repo

```
node scripts/updater-e2e-staging.mjs setup --repo Nexus-Mods/vortex-updater-e2e \
  --versions v9.0.0,v9.1.0-beta.1,v9.0.1
```

Order matters. Listing the beta before the older stable publishes the
stable last, which recreates the interleaved publish dates behind the
original field bug (a stable hotfix published after a beta, offered to beta
users as "the latest version"). The script downloads each draft's assets,
creates the release on the scratch repo with the prerelease flag derived
from the version, and tags the body with a marker so teardown only ever
deletes its own releases.

Confirm what an unauthenticated updater will see:

```
curl -s https://api.github.com/repos/Nexus-Mods/vortex-updater-e2e/releases | \
  jq -r '.[] | "\(.tag_name) pre=\(.prerelease) \(.published_at)"'
```

## 3. Point Vortex at it

Vortex reads three env vars at startup. For Start menu launches they have
to be user-level, not shell-level:

```powershell
[Environment]::SetEnvironmentVariable("VORTEX_UPDATER_REPO", "Nexus-Mods/vortex-updater-e2e", "User")
[Environment]::SetEnvironmentVariable("VORTEX_UPDATER_API_BASE", $null, "User")
[Environment]::SetEnvironmentVariable("VORTEX_UPDATER_DOWNLOAD_BASE", $null, "User")
```

The two `_BASE` vars must be empty. If they're left over from a mock feed
session, Vortex will hit localhost instead of GitHub and the rehearsal
proves nothing.

Then install the oldest fixture:

```
gh release download v9.0.0 --repo Nexus-Mods/vortex-updater-e2e --pattern '*.exe' --dir .
Get-AuthenticodeSignature .\vortex-setup-9.0.0.exe   # Status should be Valid
.\vortex-setup-9.0.0.exe
```

No `publisherName` strip is needed. These are signed builds, which is the
point. Do not launch Vortex from a terminal; the inherited handles cause
file-lock failures at install time. Use the Start menu.

## 4. Watch the log

`%APPDATA%\Vortex\vortex.log`. Every updater transition is one line:

```
tail -F "$APPDATA/Vortex/vortex.log" | grep --line-buffered -E \
  "Updater state|Differential download|fallback to full|Verifying signature|Vortex Version|Installing|elevate.exe|Downgrade"
```

Progress ticks log at debug as `downloading 9.0.1 (patch 42%)`; everything
else is info.

## 5. The matrix

| #   | do this                            | expect in the UI                                                                                      | expect in the log                                                                                                                                       |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Launch 9.0.0, Stable               | nothing, then "Vortex will update on restart" [Restart Now]                                           | `checking → downloading 9.0.1 (patch)`, `Differential download`, `Verifying signature`, `staged 9.0.1 (patch)`. 9.0.1 picked over the newer-dated beta. |
| 2   | Quit Vortex, cancel the UAC prompt | nothing installs                                                                                      | `Installing staged update on quit`, `elevate.exe`. Next launch re-stages.                                                                               |
| 3   | Restart Now, accept UAC            | NSIS wizard, then "Vortex was updated to 9.0.1" [View changes]                                        | `Vortex Version "9.0.1"`, `checking → idle`                                                                                                             |
| 4   | Switch channel to Beta             | "Vortex 9.1.0-beta.1 is available to download" [What's New, Download]                                 | `checking(manual) → available 9.1.0-beta.1`                                                                                                             |
| 5   | What's New                         | dialog shows the scratch release body                                                                 |                                                                                                                                                         |
| 6   | Download                           | "Downloading Vortex 9.1.0-beta.1 (n%)", no buttons, then "ready to install" [What's New, Restart Now] | `downloading … (update)`, `staged … (update)`                                                                                                           |
| 7   | Restart Now, accept UAC            | 9.1.0-beta.1 boots with "was updated"                                                                 | `Vortex Version "9.1.0-beta.1"`, `checking → idle`                                                                                                      |
| 8   | Switch channel to Stable           | "Vortex 9.0.1 is a downgrade and older than your current version" [More]                              | `checking(manual) → downgrade-offered 9.0.1`                                                                                                            |
| 9   | More, Stay on current version      | notification gone; Check now says up to date                                                          | `Downgrade offer declined`, `→ idle`                                                                                                                    |
| 10  | Beta, then Stable again            | offer comes back                                                                                      | `→ downgrade-offered 9.0.1`                                                                                                                             |
| 11  | More, Downgrade                    | "Downgrading to Vortex 9.0.1 (n%)", then "Vortex will update on restart" [Restart Now]                | `Downgrade download confirmed`, `downloading … (downgrade)`, `staged … (downgrade)`                                                                     |
| 12  | Restart Now, accept UAC            | 9.0.1 boots. **No** "Downgrade detected" dialog.                                                      | `Expected downgrade detected, skipping warning {"from":"9.1.0-beta.1","to":"9.0.1"}`                                                                    |

Differential downloads need `%LOCALAPPDATA%\vortex-updater\installer.exe`,
which the NSIS installer copies there at install time. If you wipe that
folder between runs the next download is a full one (`fallback to full
download: ENOENT`), which is fine but tells you nothing about blockmaps.
Wipe only `pending\` and `current.blockmap` if you want to re-run a leg.

## 6. Teardown

```
node scripts/updater-e2e-staging.mjs teardown --repo Nexus-Mods/vortex-updater-e2e
[Environment]::SetEnvironmentVariable("VORTEX_UPDATER_REPO", $null, "User")
```

Teardown deletes the marker-bearing releases and their tags and leaves the
repo. The Vortex-Staging drafts stay too; delete them by hand if you don't
want them accumulating. Then reinstall production Vortex.

## Results, 2026-08-24

Branch `task/updater-e2e-rehearsal` (state machine stack at `61fa19096`
plus the CI prerelease change). CI runs 32777497264, 32777500914, 32777504005. Scratch repo `Nexus-Mods/vortex-updater-e2e`.

All twelve legs passed. Notes beyond pass/fail:

- CI derived the prerelease flag correctly on all three drafts without a
  human touching them.
- The resolver picked 9.0.1 for Stable with 9.1.0-beta.1 published earlier
  and 9.0.1 published last. This is the original field bug, fixed against
  live GitHub.
- Signature verification passed on every download (three installs). The
  library warns that we match on CN only (`Black Tree Gaming Ltd`) and
  suggests the full DN in `publisherName`. Same as master; worth a
  follow-up, not part of this stack.
- Differential downloads worked over the GitHub CDN redirect on three of
  four attempts, at about 4 seconds for a 365 MB installer against 8
  seconds for the full download. The miss was the very first attempt, with
  `%LOCALAPPDATA%\vortex-updater` still holding entries from the previous
  week's unsigned builds: sha512 mismatch after assembly, clean fallback to
  a full download, update still staged. A fresh install never has that
  state.
- Install on quit with the UAC prompt cancelled did nothing, and the next
  launch re-staged 9.0.1 within 7 seconds of startup.
- Restart Now to new version booting: 28 to 110 seconds across the three
  installs, most of it the NSIS wizard.
- The `expectedDowngradeTo` marker suppressed the "Downgrade detected"
  dialog on the 9.1.0-beta.1 to 9.0.1 install.
- Setup snag: the scratch repo was brand new and empty, and `gh release
create` failed with `422 Repository is empty`. Seeding a README commit
  fixed it. The script should do this itself.
