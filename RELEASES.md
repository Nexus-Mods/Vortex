# Releases

How Vortex is released and what to expect as a user or extension developer.

## Release cadence

Vortex follows a 2-week beta cycle:

- A beta release is cut from master on a Monday and made available to public beta testers and QA.
- Two weeks later, after bug fixes, the same release branch is promoted to stable.
- A new beta cycle starts after each stable.

New features and fixes typically reach users within 2-4 weeks of merging. All stable releases go through automated tests and a 2-week public beta period.

### Upcoming releases

| Cycle       | Beta cut | Stable |
| ----------- | -------- | ------ |
| Coming soon | —        | —      |

The schedule will be populated once we're confident in the cadence.

## Update channels

Three update channels are available in Vortex's settings:

- **Stable:** the default. Released following the 2-week beta cycle.
- **Beta:** receives pre-release builds. For users and extension developers who want to try changes early.
- **No automatic updates:** manual only.

[Nightly builds](https://github.com/Nexus-Mods/Vortex/actions/workflows/nightly.yml) are also available as unpacked artifacts on GitHub for testing the latest master. These are not pushed via the update channel.

## For extension developers

The Vortex API is published to NPM alongside every beta and stable release. Build your extensions against:

- The stable API for production.
- The beta API to test against the next release before it ships.

API changes are documented in:

- [vortex-api CHANGELOG](https://github.com/Nexus-Mods/Vortex/blob/master/packages/vortex-api/CHANGELOG.md)
- [vortex-api MIGRATION guide](https://github.com/Nexus-Mods/Vortex/blob/master/packages/vortex-api/docs/MIGRATION.md)

[Nightly builds](https://github.com/Nexus-Mods/Vortex/actions/workflows/nightly.yml) can also be used to test extensions against the latest API ahead of beta. If you're testing deployment behaviour, use a separate test game install.

> [!NOTE]
> ⚠️ Running two Vortex instances against the same game folder will get them out of sync. A Vortex instance is only aware of the changes it has made to a game folder, it can’t pick up changes made to the game folder outside of Vortex.

## Breaking changes

Where possible, API changes that affect extensions go through a 2-release deprecation window: the old behaviour stays for ~4 weeks before being removed. Affected authors are notified at deprecation time.

For changes that can’t be deprecated (such as React upgrades), the breaking change ships in a single release. Affected authors are notified directly when the change lands on master, with the API diff and target stable date.

Timing for the breaking release:

- **As soon as a breaking change lands on master:** direct notification to affected authors.
- **T-2 weeks (beta cut):** public announcement in the Nexus Discord (#vortex, #vortex-testing), Mod Author Discord, and forums. Beta is available; new API is on NPM.
- **T-0:** stable ships.

Minimum notice for the breaking release is 2 weeks (beta cut). For deprecation-eligible changes, total notice from deprecation to breaking release is 4+ weeks.

If an extension author doesn't respond before stable, the extension may not work correctly with the new Vortex version.

If a critical extension's author hasn't responded by stable release day, the Vortex team may contribute a compatibility patch to keep users’ setups working. We make a final outreach attempt, check the licence allows modification, download and patch the existing extension build, and publish the patched version on Nexus Mods clearly labelled as community-maintained, with attribution to the original author.

The compatibility patch is a one-off fix. We're not adopting the extension as a long-term maintained product. If the original author resurfaces, maintenance can be handed back.

## Bug reports and hotfixes

Bugs in stable releases are fixed in priority order:

1. **Urgent:** data loss/corruption or core functionality broken.
2. **High:** disrupts core functionality.
3. **Medium:** larger UX or UI issues.
4. **Low:** small UX or UI issues.

Urgent and High bugs found after stable are addressed via hotfix releases. Medium and Low fixes are rolled into the next release.

Report bugs on [GitHub Issues](https://github.com/Nexus-Mods/Vortex/issues).

## Where to follow along

- Release Notes: shown in Vortex when an update is available.
- Discord: #vortex and #vortex-testing in the Nexus Discord. Extension developers should also join the Mod Author Discord.
- GitHub: [Vortex releases](https://github.com/Nexus-Mods/Vortex/releases).
- Forums: [Nexus Mods forums](https://github.com/Nexus-Mods/Vortex/issues).
