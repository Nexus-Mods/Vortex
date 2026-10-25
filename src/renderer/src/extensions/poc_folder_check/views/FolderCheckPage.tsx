/**
 * Dev-only PoC: shows which files in the active Steam game's folder came from Steam, which from
 * Vortex and which from neither, and what it would take to make the folder clean. Read-only.
 * See docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md.
 */
import type {
  FolderCheckFile,
  FolderCheckInput,
  FolderCheckMode,
  FolderCheckResult,
  FolderCheckStatus,
} from "@vortex/shared/ipc";
import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { ISteamEntry } from "@/util/Steam";
import { useRelativeTime } from "@/util/useRelativeTime";
import { bytesToString } from "@/util/util";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { normPath } from "../../analytics/utils/storeGameVersionEvent";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { getGame, getGameStores } from "../../gamemode_management/util/getGame";
import { activeGameId } from "../../profile_management/selectors";
import { type CheckInputResult, resolveCheckInput } from "../utils/resolveCheckInput";
import { type IFolderSummary, summarise } from "../utils/summarise";

const POLL_INTERVAL_MS = 500;

async function loadCheckInput(
  gameId: string,
  discoveryPath: string | undefined,
): Promise<CheckInputResult> {
  const steam = getGameStores().find((store) => store.id === "steam");
  if (steam === undefined) {
    return { ok: false, reason: "Vortex couldn't find the Steam install." };
  }
  const steamEntries = (await steam.allGames()) as ISteamEntry[];
  return resolveCheckInput({
    discoveryPath,
    steamAppId: getGame(gameId)?.details?.steamAppId,
    steamEntries,
    steamExePath: await steam.getGameStorePath(),
  });
}

/**
 * Starts or restarts the check and follows its status until it stops running. Only while the page
 * is showing: pages stay mounted when hidden, and a check reads from every base game file.
 */
function useFolderCheck(input: FolderCheckInput | undefined, active: boolean) {
  const [status, setStatus] = useState<FolderCheckStatus>({ state: "idle" });

  // never show one game's result under another's
  useEffect(() => {
    setStatus({ state: "idle" });
  }, [input]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generationRef = useRef(0);

  const run = useCallback(
    (force: boolean, mode: FolderCheckMode) => {
      if (input === undefined) return;
      clearTimeout(timerRef.current);
      const current = ++generationRef.current;
      const poll = async () => {
        const next = await window.api.poc.getFolderCheckStatus(input.appId);
        if (current !== generationRef.current) return;
        setStatus(next);
        if (next.state === "running") {
          timerRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      };
      void window.api.poc.startFolderCheck(input, force, mode).then(poll);
    },
    [input],
  );

  useEffect(() => {
    if (!active) return undefined;
    run(false, "quick");
    return () => {
      generationRef.current++;
      clearTimeout(timerRef.current);
    };
  }, [run, active]);

  return {
    status,
    recheck: (mode: FolderCheckMode) => run(true, mode),
  };
}

/** "0.4 s" under ten seconds, "40 s" under a minute, then "2 min 5 s" */
function formatDuration(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SWATCH = {
  game: "bg-success-moderate",
  vortex: "bg-info-moderate",
  unknown: "bg-warning-moderate",
  modified: "bg-danger-moderate",
  missing: "bg-premium-moderate",
  changed: "bg-info-strong",
} as const;

const Swatch = ({ className }: { className: string }) => (
  <span className={joinClasses(["inline-block size-2.5 shrink-0 rounded-xs", className])} />
);

const SummaryBar = ({ summary }: { summary: IFolderSummary }) => {
  const { counts } = summary;
  const segments = [
    { key: "game", label: "Game", ...counts.game },
    { key: "vortex", label: "Vortex", ...counts.vortex },
    { key: "unknown", label: "Unknown", ...counts.unknown },
  ] as const;
  const flags = [
    { key: "modified", label: "Modified", files: summary.modified },
    { key: "missing", label: "Missing", files: summary.missing },
    { key: "changed", label: "Changed since deployed", files: summary.changedSinceDeployed.files },
  ] as const;
  return (
    <div className="space-y-2">
      {/* by bytes: a game is a few huge files, a mod setup many small ones */}
      <div className="flex h-4 overflow-hidden rounded-sm">
        {segments.map((segment) => (
          <div
            className={SWATCH[segment.key]}
            data-testid={`folder-bar-${segment.key}`}
            key={segment.key}
            style={{ flexGrow: segment.bytes }}
          />
        ))}
      </div>

      <Typography as="div" className="flex flex-wrap gap-x-4 gap-y-1" typographyType="body-sm">
        {segments.map((segment) => (
          <span className="flex items-center gap-1" key={segment.key}>
            <Swatch className={SWATCH[segment.key]} />

            {`${segment.label} ${segment.files} · ${bytesToString(segment.bytes)}`}
          </span>
        ))}

        {flags.map((flag) => (
          <span className="flex items-center gap-1" key={flag.key}>
            <Swatch className={SWATCH[flag.key]} />

            {`${flag.label} ${flag.files}`}
          </span>
        ))}
      </Typography>
    </div>
  );
};

const CleanSteps = ({
  result,
  summary,
}: {
  result: FolderCheckResult;
  summary: IFolderSummary;
}) => {
  const changed = summary.changedSinceDeployed;
  const restore = summary.modified + summary.missing;
  return (
    <div className="space-y-3 rounded-sm border border-stroke-weak p-4">
      <Typography className="font-semibold" typographyType="title-sm">
        To make it clean
      </Typography>

      {/* numbered in the text: a flex row hides list markers */}
      <Typography as="div" className="space-y-2" typographyType="body-sm">
        <div className="flex items-center justify-between gap-4">
          <span>
            {`1. Move ${plural(summary.counts.unknown.files, "unknown file")} (${bytesToString(summary.counts.unknown.bytes)}) out of the game folder`}

            {changed.files > 0 ? `, plus ${changed.files} Vortex files changed since deployed` : ""}
          </span>

          <Button disabled size="sm">
            Archive (later)
          </Button>
        </div>

        <p>2. Remove the empty folders left behind</p>

        <div className="flex items-center justify-between gap-4">
          <span>{`3. Restore ${restore} modified or missing game files with Steam's verify`}</span>

          <Button disabled size="sm">
            Verify in Steam
          </Button>
        </div>

        {result.baseFilesWithBackup > 0 && (
          <p>
            {`Purge in Vortex first: Steam's verify would overwrite ${result.baseFilesWithBackup} files Vortex has deployed over game files.`}
          </p>
        )}

        {result.unreadable.length > 0 && (
          <p>{`${result.unreadable.length} files couldn't be read and weren't compared.`}</p>
        )}
      </Typography>
    </div>
  );
};

interface IListedFile {
  relPath: string;
  size: number;
  /** Absent for missing files */
  mtimeMs?: number;
}

const sumSize = (files: IListedFile[]) => files.reduce((sum, file) => sum + file.size, 0);

/** A collapsible row: a bucket at the top level, or a folder inside the Unknown bucket. */
const Section = ({
  bytes,
  children,
  count,
  defaultOpen = false,
  nested = false,
  swatch,
  title,
}: {
  bytes: number;
  children: ReactNode;
  count: number;
  defaultOpen?: boolean;
  nested?: boolean;
  swatch?: string;
  title: string;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={joinClasses({ "border-b border-stroke-weak": !nested })}>
      <button
        className={joinClasses(
          [
            "flex w-full items-center justify-between gap-4 py-1.5 pr-2 text-left hover:bg-translucent-weak",
          ],
          { "pl-2": !nested, "pl-7": nested },
        )}
        type="button"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <span>{open ? "▾" : "▸"}</span>

          {swatch !== undefined && <Swatch className={swatch} />}

          <span className={joinClasses({ "font-semibold": !nested })}>{title}</span>
        </span>

        <span className="shrink-0">{`${count} · ${bytesToString(bytes)}`}</span>
      </button>

      {open && children}
    </div>
  );
};

const FileRows = ({ files, nested = false }: { files: IListedFile[]; nested?: boolean }) =>
  files.map((file) => (
    <div
      className={joinClasses(["flex justify-between gap-4 py-1 pr-2"], {
        "pl-8": !nested,
        "pl-14": nested,
      })}
      key={file.relPath}
    >
      <span className="truncate">{file.relPath}</span>

      <span className="shrink-0">
        {file.mtimeMs !== undefined
          ? `${new Date(file.mtimeMs).toLocaleDateString()} · ${bytesToString(file.size)}`
          : bytesToString(file.size)}
      </span>
    </div>
  ));

const FileLists = ({ result, summary }: { result: FolderCheckResult; summary: IFolderSummary }) => {
  const byBucket = (bucket: FolderCheckFile["bucket"]) =>
    result.files.filter((file) => file.bucket === bucket);
  const modified = result.files.filter((file) => file.modified);
  const changed = result.files.filter((file) => file.changedSinceDeployed);
  return (
    <Typography as="div" typographyType="body-sm">
      <Section
        defaultOpen
        bytes={summary.counts.unknown.bytes}
        count={summary.counts.unknown.files}
        swatch={SWATCH.unknown}
        title="Unknown files"
      >
        {summary.unknownGroups.map((group) => (
          <Section
            nested
            bytes={group.bytes}
            count={group.files.length}
            key={group.folder}
            title={group.folder}
          >
            <FileRows nested files={group.files} />
          </Section>
        ))}
      </Section>

      {modified.length > 0 && (
        <Section
          bytes={sumSize(modified)}
          count={modified.length}
          swatch={SWATCH.modified}
          title="Modified game files"
        >
          <FileRows files={modified} />
        </Section>
      )}

      {result.missing.length > 0 && (
        <Section
          bytes={sumSize(result.missing)}
          count={result.missing.length}
          swatch={SWATCH.missing}
          title="Missing game files"
        >
          <FileRows files={result.missing} />
        </Section>
      )}

      {changed.length > 0 && (
        <Section
          bytes={sumSize(changed)}
          count={changed.length}
          swatch={SWATCH.changed}
          title="Changed since deployed"
        >
          <FileRows files={changed} />
        </Section>
      )}

      <Section
        bytes={summary.counts.game.bytes}
        count={summary.counts.game.files}
        swatch={SWATCH.game}
        title="Game files"
      >
        <FileRows files={byBucket("game")} />
      </Section>

      <Section
        bytes={summary.counts.vortex.bytes}
        count={summary.counts.vortex.files}
        swatch={SWATCH.vortex}
        title="Vortex files"
      >
        <FileRows files={byBucket("vortex")} />
      </Section>
    </Typography>
  );
};

const StatusMessage = ({ status }: { status: FolderCheckStatus }) => {
  switch (status.state) {
    case "running": {
      const percent =
        status.bytesTotal > 0 ? Math.floor((status.bytesDone / status.bytesTotal) * 100) : 0;
      return (
        <Typography>
          {status.phase === "listing" ? "Listing files…" : `Hashing game files… ${percent}%`}
        </Typography>
      );
    }
    case "unavailable":
      return <Typography>{status.reason}</Typography>;
    case "error":
      return <Typography>{`The check failed: ${status.message}`}</Typography>;
    default:
      return null;
  }
};

export const FolderCheckPage = ({ active = true }: { active?: boolean }) => {
  const { t } = useTranslation();
  const gameId = useSelector((state: IState) => activeGameId(state));
  const discoveryPath = useSelector((state: IState) => discoveryByGame(state, gameId)?.path);
  const [resolved, setResolved] = useState<CheckInputResult | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setResolved(undefined);
    void loadCheckInput(gameId, discoveryPath).then((next) => {
      if (!cancelled) setResolved(next);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, discoveryPath]);

  const input = resolved?.ok ? resolved.input : undefined;
  const { status, recheck } = useFolderCheck(input, active);
  const result = status.state === "done" ? status.result : undefined;
  const summary = useMemo(() => (result !== undefined ? summarise(result) : undefined), [result]);
  const checked = useRelativeTime(result?.checkedAt, t);

  const subtitle =
    input !== undefined
      ? [
          "Steam",
          `build ${input.buildId}`,
          `depots ${input.depots.map((depot) => depot.depotId).join(", ")}`,
          ...(checked !== undefined && result !== undefined
            ? [`${result.mode} check ${checked} in ${formatDuration(result.durationMs)}`]
            : []),
        ].join(" · ")
      : undefined;

  return (
    <Page active={active} scrollable={false}>
      <PageHeader subtitle={subtitle} title="Game folder">
        {input !== undefined && (
          <>
            <Button
              disabled={status.state === "running"}
              size="sm"
              onClick={() => recheck("quick")}
            >
              Re-check
            </Button>

            <Button
              disabled={status.state === "running"}
              size="sm"
              title="Hash every base game file whole instead of four 1 MB chunks each"
              onClick={() => recheck("full")}
            >
              Full check
            </Button>
          </>
        )}
      </PageHeader>

      <PageScroll className="space-y-6 p-6">
        {resolved?.ok === false && <Typography>{resolved.reason}</Typography>}

        {resolved?.ok === true && (
          <Typography as="div" className="space-y-1" typographyType="body-sm">
            <p className="font-semibold">{resolved.input.gamePath}</p>

            {normPath(resolved.discoveryPath) !== normPath(resolved.input.gamePath) && (
              <p>{`Vortex manages this game at ${resolved.discoveryPath}`}</p>
            )}
          </Typography>
        )}

        <StatusMessage status={status} />

        {result !== undefined && summary !== undefined && (
          <>
            <SummaryBar summary={summary} />

            <CleanSteps result={result} summary={summary} />

            <FileLists result={result} summary={summary} />
          </>
        )}
      </PageScroll>
    </Page>
  );
};

export default FolderCheckPage;
