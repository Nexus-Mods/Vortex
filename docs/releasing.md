# Releasing Vortex

The path a merged PR takes to reach a user, and which doc owns each stage. Start
here if you know how to get code onto a release branch but not what happens
after that. Every stage that has its own doc gets a link rather than a summary,
so this page stays a map.

The three things documented nowhere else are at the bottom: the automation that
fires off a release, signing as an operation rather than a boundary, and
announcing.

## The path, end to end

```
  master
    |
    +--> release branch (v2.7)            branching-and-release-strategy.md
    |          |    ^
    |          +----+  cherry-picks both ways while active
    |                                     cherry-pick-workflow.md
    v
  Package workflow, dispatched by hand    packaging/windows.md
    |
    |  builds and signs, then in parallel:
    |    * draft release on Vortex and on Vortex-Staging
    |    * installer uploaded to R2 (staged, not yet the live download)
    |
    |  the release is a draft, so the v* tag does not exist yet
    v
  Undraft the release on GitHub           publishing-releases.md
    |
    |  this is the go-live action, and there is no second step
    |
    +--> `released` fires, which uploads the installer to Nexus Mods
    |    (stable only; a pre-release fires `prereleased` instead)
    +--> the release becomes visible to the updater channel   updater.md
    +--> `prereleased` or `released` also syncs Linear and annotates Mixpanel
    +--> the v* tag is created, which marks error fingerprints released
    v
  Website download tag is pointed at the new version
    |    independent of the Nexus upload; neither waits for the other
    v
  Announce
```

[publishing-releases.md](publishing-releases.md) is the doc to have open while
doing this. It has
the dispatch inputs, the guardrails, and the troubleshooting list, including the
publish-order trap on multi-release days.

## Which doc for which stage

| Stage                                            | Doc                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Where a fix lands, and when to stop backporting  | [branching-and-release-strategy.md](branching-and-release-strategy.md)                         |
| Moving a fix between master and a release branch | [cherry-pick-workflow.md](cherry-pick-workflow.md)                                             |
| Building an installer, locally or in CI          | [packaging/windows.md](packaging/windows.md)                                                   |
| Drafting, undrafting, R2, the Nexus upload       | [publishing-releases.md](publishing-releases.md)                                               |
| How users are offered the update                 | [updater.md](updater.md)                                                                       |
| Exercising the update cycle before shipping      | [updater-testing.md](updater-testing.md), [updater-rehearsal.md](updater-rehearsal.md)         |
| Linux packaging                                  | [packaging/flatpak.md](packaging/flatpak.md), [flatpak/maintenance.md](flatpak/maintenance.md) |
| Which versions are still supported               | [../RELEASES.md](../RELEASES.md)                                                               |
| Drafting the changelog entry                     | `.claude/skills/changelog/skill.md`                                                            |

## Post-release automation

Five workflows run around a release without anyone asking them to. None of them
is covered by another doc.

**`linear-release.yml`** fires on `prereleased` and `released`. It works out the
commit range since the previous tag using `.github/actions/linear-release` in
`prepare` mode, syncs every issue in that range onto a Linear release named after
the tag, then marks that release complete. Dispatchable with an explicit tag;
the dispatch path defaults to `dry-run: true`, and on dispatch the channel is
inferred from the tag (a `-` means pre-release).

**`annotate-mixpanel-release.yml`** fires on `prereleased` and `released`. It
posts a "Vortex `<version>` Released" annotation to the EU Mixpanel project at
the release's publish time, converted into the project timezone. Stable and beta
use different Mixpanel tag ids so dashboards can toggle them separately. It
checks that day's existing annotations first, so a re-run does not double up.
Dispatch defaults to a dry run that prints the payload.

**`fingerprint-released.yml`** fires on a `v*` **tag push**, not on a release
event. `package.yml` creates the release as a draft, and GitHub does not create
the tag for a draft, so in the normal flow this lands at undraft time along with
the other two. The distinction matters when something is not the normal flow: a
tag pushed by hand, moved, or recreated triggers this and nothing else. It runs
`.github/actions/fingerprints` in `release` mode against ClickHouse to mark
error fingerprints as released. See
[error-reporting/](error-reporting/README.md) for what fingerprints are and how
they are resolved.

**`nightly.yml`** packages Vortex every day at 19:00 UTC on a Windows runner with
`use-codesigning: "false"`, and uploads the unpacked build, the installer and
`latest.yml` as artifacts with two-day retention. Nothing is published or
distributed. It is a build canary: if packaging has broken, this tells you
before a release does.

**`signing-test.yml`** is covered in the next section.

Both `linear-release.yml` and `annotate-mixpanel-release.yml` treat betas as
releases. This is worth remembering, because the Nexus upload does not: a beta
updates Linear and Mixpanel while never reaching the site.

## Signing as an operation

[packaging/windows.md](packaging/windows.md) draws the boundary correctly:
signing happens in CI, the secrets are not available locally, and you should not
run `pnpm package` on your machine. What follows is the operational side.

Signing uses SSL.com's eSigner via their CodeSignTool, driven by four secrets:
`ES_USERNAME`, `ES_PASSWORD`, `ES_CREDENTIAL_ID` and `ES_TOTP_SECRET`. The
Package workflow takes them as environment variables, and
`.github/actions/package` falls back to an unsigned build when they are absent.

Two scripts at the repo root exist for this and nothing else:

- `download-codesigntool.ps1` fetches the current CodeSignTool release from
  `SSLcom/CodeSignTool` on GitHub, resolving the version dynamically rather than
  pinning it, and extracts it to `./CodeSignTool`.
- `test-codesigntool.ps1` checks the extracted tool is there, then runs
  `CodeSignTool.bat credential_info` with those credentials. It does not sign
  anything. It confirms the credentials and the certificate are usable.

**`signing-test.yml` runs that pair every Wednesday at 14:05 UTC**, plus on
dispatch. It is the cert-and-credential canary, and it uses the same four
secrets the Package workflow does, so a green run is real evidence that the next
release will be able to sign.

The consequence worth internalising: because CodeSignTool is fetched fresh rather
than pinned, and because the credentials sit behind a certificate that expires,
signing can break without anything in this repo changing. A red Signing Test on a
Wednesday is the warning. If it is ignored, the next release either produces an
unsigned installer or fails outright, and unsigned builds also change updater
behaviour (see the `publisherName` caveat in
[updater-testing.md](updater-testing.md)).

## Announcing

Nothing in this repository or in CI does any of this. It is a manual process
owned partly by engineering and partly by content and community.

> Reconstructed from Slack rather than from anything in the repo. Treat the
> shape as right and the specifics as needing confirmation from the release
> manager and the comms side before you rely on them.

**The handoff.** The release manager posts "Vortex vX.Y is now live!" in
`#team-lazer-sharks` and tags the comms subteam. That tag is the handoff, and
forgetting it stalls everything downstream, because nobody outside the channel
knows there is anything to do.

**The changelog is not the release notes.** These are two different documents for
two different audiences, and conflating them has caused repeated problems.

- `CHANGELOG.md` is engineering-facing. It records what merged, with PR links.
  The repo is public, so it can and does reference things users cannot yet see.
- Release notes are user-facing, written by content, and must exclude anything a
  user cannot reach. A feature that is merged but suppressed behind a feature
  flag does not belong in them.

Both failure modes have happened: release notes describing a health-check feature
that was merged but hidden in the UI, and a "full changelog" link pointing at the
previous release's branch. If you are the engineer being asked what to highlight,
give content the specific user-visible features rather than pointing them at the
changelog and hoping.

**Feature flags are part of releasing.** Unleash constraints are set per version
by hand, by someone outside the release workflow, in the form "this version and
newer". Unleash has no greater-than-or-equal operator, so a naive greater-than
constraint excludes the very release you are shipping. If a release depends on a
flag being on, confirm the constraint includes the boundary version and that
someone has actually set it.

**The site can hold the file back.** An uploaded `.exe` can sit blocked pending
content preview generation and needs releasing by hand before the download works.
The release is not usable at that point even though every workflow went green.
The same trap applies to game and community extensions; see
[game-support.md](game-support.md).

**Betas never reach the Nexus site.** They go out through GitHub Releases and the
updater beta channel only. `publishing-releases.md` covers the mechanism (the
`released` event does not fire for a pre-release); it matters here because it is
what people get wrong when announcing.

**Wider distribution** goes out through Discord and named community curators,
plus a news post on the site for a major release. That is content and community
territory, not engineering's.

## Key Files

| Path                                                 | Purpose                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `.github/workflows/package.yml`                      | The release build. Dispatch only. Inputs for artifacts, signing, the two draft releases and the R2 upload |
| `.github/actions/package/action.yml`                 | What the build actually does, including the signing fallback                                              |
| `.github/workflows/upload-release-to-r2.yml`         | Manual R2 upload, the fallback when the packaged one did not land                                         |
| `.github/workflows/linear-release.yml`               | Syncs issues onto a Linear release                                                                        |
| `.github/workflows/annotate-mixpanel-release.yml`    | Mixpanel annotation per release                                                                           |
| `.github/workflows/fingerprint-released.yml`         | Marks error fingerprints released, on `v*` tag push                                                       |
| `.github/workflows/nightly.yml`                      | Unsigned nightly package as a build canary                                                                |
| `.github/workflows/signing-test.yml`                 | Weekly signing credential canary                                                                          |
| `download-codesigntool.ps1`, `test-codesigntool.ps1` | Fetch and validate SSL.com CodeSignTool                                                                   |
| `scripts/verify-packaged-asar.mjs`                   | Guards against electron-builder shipping wrong nested dependency versions                                 |
