# Branching and Release Strategy

Master is always the latest code. It is the main development line and where all new work starts.

When a version is ready to stabilise for release, it gets its own branch off master. For example, v2.0 has a branch called `v2.0`. All work for that version (alphas, beta, stable) happens on that branch.

Future versions follow the same pattern. v2.1 will branch off master when the time comes, and so on.

### Where bug fixes go

If a bug affects both the release branch and master, it needs to be fixed in both places. Fix it on whichever branch is most relevant first, then cherry-pick to the other.

If a bug only affects the release branch (something specific to that version's stabilisation work), fix it there. No need to cherry-pick to master.

If a bug only affects master (something introduced after the release branch was cut), fix it on master. No need to cherry-pick to the release branch.

When in doubt, raise it with the rest of the team.

### When to stop backporting

Once a version hits stable and the next version's branch has been cut, the old release branch goes into maintenance mode. At that point, only critical fixes (crashes, data loss, security) get backported. Everything else stays on master or the new release branch.

If you're unsure whether a fix qualifies as critical, ask before cherry-picking.

### Tagging and naming

Release branches are named after the version: `v2.0`, `v2.1`, etc.

Tags follow semver: `v2.0.0-alpha.1`, `v2.0.0-beta.1`, `v2.0.0` for stable. Patch releases are tagged as `v2.0.1`, `v2.0.2`, etc.

### Hotfixes on stable releases

If a critical bug is found in a stable release that's already shipped, fix it on the release branch and tag a new patch version. Cherry-pick to master if the bug exists there too.

Don't create separate hotfix branches. The release branch is where hotfixes live.

## Summary

Master is home. Release branches are temporary stabilisation forks. Fixes flow both ways while a release branch is active, and the branch winds down once the next version takes over. We'll keep reviewing this process as we speed up and the team grows.
