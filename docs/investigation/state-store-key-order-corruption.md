# State store key-order corruption (GH#23981, LAZ-978)

## Overview

- [Symptom](#symptom): mod and download records vanish from the app while remaining
  intact on disk, differently on each launch, silently.
- [Root cause](#root-cause): table files inside the leveldb store hold keys that
  are not in sorted order. The MANIFEST's overlapping ranges are a consequence,
  not the cause.
- [Trigger](#trigger): **not identified.** Evidence points away from disk
  corruption and towards a stale block being served during a compaction.
- [Amplification](#amplification): Vortex's reconcilers read "absent" as "the
  user deleted it" and persist the absence, converting a read fault into
  permanent damage. **This is the part we fixed.**
- [Why no store-level fix shipped](#why-no-store-level-fix-shipped): detection and
  repair were built, measured working, and then dropped - maintenance cost
  against a single confirmed user, and a hard dependency on leveldb internals.
- [If it recurs](#if-it-recurs): what to do, and where the abandoned
  implementation lives.

## Symptom

The reporter (GH#23981, Vortex 2.5.0) saw nine game branches - roughly 750 mod
records - disappear from the app across launches, with different subsets missing
each time. A prefix seek for `persistent###mods###cyberpunk2077` returned 0 rows
on his store while a full scan of the same attached store returned 14,701. The
data was never deleted: every record for every game was still physically present.

## Root cause

Five table files per snapshot contained internally unsorted keys - 15 to 16
out-of-order transitions, both across data-block boundaries and within single
blocks.

leveldb resolves reads on the assumption that every table is sorted. Its merging
iterator and DB iterator both skip anything sorting below what they have already
emitted, so runs of live keys become invisible while sitting intact on disk. The
inverted and overlapping level-2 ranges in the MANIFEST are derived honestly by
leveldb from tables that were already misordered - chasing them leads to the
symptom, not the cause.

`leveldb::TableBuilder::Add` checks sortedness only under `assert`, so a release
build (`NDEBUG`) writes such a table silently, and every later compaction that
reads it passes the disorder into its output. This is still true on leveldb
`main`: `table/table_builder.cc` was last touched 2023-04-20, for Zstd support.

## Trigger

Unidentified. What the evidence rules out:

- **Not disk or filesystem corruption.** The reporter's chkdsk found 0 bad
  sectors. Within each damaged table, block offsets were monotonic and every
  block's contents matched its own index separator - so `TableBuilder` was _fed_
  keys out of order rather than bytes rotting in place after the write.
- **Not a same-process double writer.** leveldb's LOCK correctly rejects a second
  opener. Note that closing a DuckDB connection does not release the store; only
  DETACH does.

Reproduction attempts that failed: Vortex-shaped bulk load with mod-update churn
and concurrent read/write, on both the shipped and a freshly built level_pivot;
kill-during-compaction; and a simulated MANIFEST regression.

The closest diagnosis is from RocksDB (facebook/rocksdb#7405), where a maintainer
identifies "an ordered sequence of keys injected in the middle of another ordered
sequence" as the fingerprint of a **stale block being served** - not a bit flip,
which scrambles bytes, and not a comparator bug, which misplaces single keys.
That matches our shape exactly. Their cause was block-cache key collisions from
inode reuse, which does not apply to leveldb (its cache key is a monotonic
per-cache `NewId`). Note that checksums cannot catch this: a block read from the
wrong offset carries its own valid CRC.

## Amplification

The read fault alone is recoverable - the data is still there. What made it
permanent is that routines comparing state against another source treat absence
as deletion:

- `refreshDownloads` removed every download record for a game, with no dialog and
  no log line, and re-imported archives it could no longer see (511 duplicate
  entries in the reporter's store).
- `refreshMods` listed every mod as removed and, when the staging folder was
  genuinely unavailable, created the folder it was auditing and read it as empty.
- `sanitizeProfile` forgot every enabled-flag for a game whose mod table was
  missing - the only place those flags exist (368 lost for cyberpunk2077).
- `setModArchiveId` created a record for an unknown modId, so the archive rebind
  after a removal resurrected mods as records holding nothing but an `archiveId`:
  unremovable rows with no name that made "Mods changed on disk" reappear every
  launch. That shape exists in the reporter's backups as far back as 2.0.2.

These are fixed, and they are worth having regardless of the store-level fault:
each one guards a filesystem or race input - a wrong drive letter, an unmounted
path, a mod mid-install - that has nothing to do with leveldb.

## Why no store-level fix shipped

A detection and repair layer was built in level_pivot and measured working
against the reporter's store:

| approach                               | keys recovered (of 308,990) |
| -------------------------------------- | --------------------------- |
| `leveldb::RepairDB` alone              | 267,734                     |
| direct table reads, merged by sequence | **308,990** (0 unparsable)  |

Attach-time detection cost ~27ms on that 24MB / 309k-key store, and a write-time
guard (`TableBuilder` rejecting unsorted keys in release builds, mirroring
RocksDB's `check_flush_compaction_key_order`) caught the corruption on the
reporter's real data, naming both offending keys.

It was dropped anyway:

- **`RepairDB` is not a usable substitute.** It loses 41,256 keys - Ace Combat 7
  entirely, 286 of 395 Baldur's Gate 3 mods, 511 of 3,615 downloads. Its
  `ScanTable` takes each table's first key as `smallest` and updates `largest` as
  it iterates, so it trusts stored order and only skips keys that fail to parse.
  It also leaves the tables unsorted: the first compaction after it trips, and
  `RecordBackgroundError` latches `bg_error_`, making the store read-only.
- **Upstream will not fix this soon.** No key-order check has been proposed to
  google/leveldb; the project is in maintenance mode, with recent merges being
  submodule bumps. google/leveldb#1343 is an open, unanswered data-loss defect in
  `RepairDB` itself.
- **The cost did not match the exposure.** Full detection and repair came to ~820
  lines of C++ depending on six leveldb-internal headers plus a patch against
  vendored upstream, against one confirmed affected user - and it would be
  obsoleted the moment upstream fixed either problem.

Vortex's "Repair" button is a separate, pre-existing no-op: the dialog promises
"Vortex will now try to repair the database", and `LevelPersist.create` logs
`repair requested but not supported, ignoring`. The repair implementation was
dropped in the leveldb-to-DuckDB migration while the copy and call chain stayed.
The reporter described this verbatim - "clicking Repair there doesn't seem to fix
anything". Tracked separately.

## If it recurs

1. Get the user's `state.v2`. Confirm the shape before assuming: read each live
   table's entries in file order and check they ascend, remembering that
   `InternalKeyComparator` orders by user key ascending then sequence
   **descending**.
2. Repair out-of-process rather than in the app. A standalone tool can read every
   live table directly, merge newest-sequence-wins honouring tombstones, and
   write a fresh store - that is what recovered all 308,990 keys.
3. Read only the files the descriptor lists. A table left behind by a compaction
   is still full of readable keys, including keys whose tombstones leveldb
   legitimately dropped at the base level; reading it resurrects deleted data.
4. The abandoned implementation - reader, verifier, rebuild, write-time guard,
   fixture generator and tests - is on the `archive/laz-978-leveldb-repair`
   branch of the level_pivot repository. It is not fit to merge as-is, but it
   works and it is a faster starting point than rediscovery.
