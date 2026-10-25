/**
 * Dev-only PoC: shows which files in the active Steam game's folder came from Steam, which from
 * Vortex and which from neither, and what it would take to make the folder clean. Read-only.
 * See docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md.
 */
import type {
  FolderCheckFile,
  FolderCheckInput,
  FolderCheckResult,
  FolderCheckStatus,
} from "@vortex/shared/ipc";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
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

/** Starts or restarts the check and follows its status until it stops running. */
function useFolderCheck(input: FolderCheckInput | undefined) {
  const [status, setStatus] = useState<FolderCheckStatus>({ state: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generationRef = useRef(0);

  const run = useCallback(
    (force: boolean) => {
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
      void window.api.poc.startFolderCheck(input, force).then(poll);
    },
    [input],
  );

  useEffect(() => {
    run(false);
    return () => {
      generationRef.current++;
      clearTimeout(timerRef.current);
    };
  }, [run]);

  return { status, recheck: () => run(true) };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SummaryBar = ({ summary }: { summary: IFolderSummary }) => {
  const { counts } = summary;
  const segments = [
    { key: "game", label: "Game", className: "bg-success-moderate", ...counts.game },
    { key: "vortex", label: "Vortex", className: "bg-info-moderate", ...counts.vortex },
    { key: "unknown", label: "Unknown", className: "bg-warning-moderate", ...counts.unknown },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-4 overflow-hidden rounded-sm">
        {segments.map((segment) => (
          <div
            className={segment.className}
            key={segment.key}
            style={{ flexGrow: segment.files }}
          />
        ))}
      </div>

      <Typography as="div" className="flex flex-wrap gap-x-4 gap-y-1" typographyType="body-sm">
        {segments.map((segment) => (
          <span className="flex items-center gap-1" key={segment.key}>
            <span className={`inline-block size-2.5 rounded-xs ${segment.className}`} />

            {`${segment.label} ${segment.files} · ${bytesToString(segment.bytes)}`}
          </span>
        ))}

        <span>{`Modified ${summary.modified}`}</span>

        <span>{`Missing ${summary.missing}`}</span>

        <span>{`Changed since deployed ${summary.changedSinceDeployed.files}`}</span>
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

const FileGroup = ({
  title,
  files,
  bytes,
}: {
  title: string;
  files: FolderCheckFile[];
  bytes: number;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stroke-weak">
      <button
        className="flex w-full justify-between gap-4 px-2 py-1.5 text-left hover:bg-translucent-weak"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <span>{`${open ? "▾" : "▸"} ${title}`}</span>

        <span className="shrink-0">{`${files.length} · ${bytesToString(bytes)}`}</span>
      </button>

      {open &&
        files.map((file) => (
          <div className="flex justify-between gap-4 py-1 pr-2 pl-8" key={file.relPath}>
            <span className="truncate">{file.relPath}</span>

            <span className="shrink-0">
              {`${new Date(file.mtimeMs).toLocaleDateString()} · ${bytesToString(file.size)}`}
            </span>
          </div>
        ))}
    </div>
  );
};

const FileLists = ({ result, summary }: { result: FolderCheckResult; summary: IFolderSummary }) => {
  const byBucket = (bucket: FolderCheckFile["bucket"]) =>
    result.files.filter((file) => file.bucket === bucket);
  return (
    <Typography as="div" typographyType="body-sm">
      <Typography className="mb-1 font-semibold" typographyType="inherit">
        {`Unknown files · ${summary.counts.unknown.files}`}
      </Typography>

      {summary.unknownGroups.map((group) => (
        <FileGroup
          bytes={group.bytes}
          files={group.files}
          key={group.folder}
          title={group.folder}
        />
      ))}

      <FileGroup bytes={summary.counts.game.bytes} files={byBucket("game")} title="Game files" />

      <FileGroup
        bytes={summary.counts.vortex.bytes}
        files={byBucket("vortex")}
        title="Vortex files"
      />
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

export const FolderCheckPage = () => {
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
  const { status, recheck } = useFolderCheck(input);
  const result = status.state === "done" ? status.result : undefined;
  const summary = useMemo(() => (result !== undefined ? summarise(result) : undefined), [result]);
  const checked = useRelativeTime(result?.checkedAt, t);

  const subtitle =
    input !== undefined
      ? [
          "Steam",
          `build ${input.buildId}`,
          `depots ${input.depots.map((depot) => depot.depotId).join(", ")}`,
          ...(checked !== undefined ? [`checked ${checked}`] : []),
        ].join(" · ")
      : undefined;

  return (
    <Page scrollable={false}>
      <PageHeader subtitle={subtitle} title="Game folder">
        {input !== undefined && (
          <Button disabled={status.state === "running"} size="sm" onClick={recheck}>
            Re-check
          </Button>
        )}
      </PageHeader>

      <PageScroll className="space-y-4 py-4">
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
