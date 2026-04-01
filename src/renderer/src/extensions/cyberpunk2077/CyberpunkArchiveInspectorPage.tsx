import type { InternalGameConflict } from "@vortex/shared/ipc";
import * as React from "react";
import { Button, FormControl, InputGroup, Panel } from "react-bootstrap";
import { useSelector } from "react-redux";

import { EmptyPlaceholder, Spinner } from "../../controls/api";
import { useMainContext } from "../../contexts";
import type { ILoadOrderEntry } from "../../types/api";
import * as selectors from "../../util/selectors";
import { currentLoadOrderForProfile } from "../file_based_loadorder/selectors";

import {
  CYBERPUNK_ARCHIVE_SELECTION_KEY,
  buildCyberpunkRuntimeSnapshot,
  formatCyberpunkBucket,
  getCyberpunkApi,
  getCyberpunkArchivePath,
  getCyberpunkBucket,
  type ICyberpunkLoadOrderData,
} from "./common";

interface IArchiveItem {
  path?: string;
  name?: string;
  virtualPath?: string;
  hash?: string;
  mappedName?: string;
  size?: number;
  type?: string;
  bucket?: string;
  children?: IArchiveItem[];
  [key: string]: any;
}

interface IArchiveInspectionResult {
  entries?: IArchiveItem[];
  contents?: IArchiveItem[];
  files?: IArchiveItem[];
  items?: IArchiveItem[];
  [key: string]: any;
}

function flattenArchiveItems(
  items: IArchiveItem[],
  depth = 0,
): Array<IArchiveItem & { depth: number; resolvedPath: string }> {
  return items.flatMap((item) => {
    const resolvedPath =
      item.path ?? item.virtualPath ?? item.mappedName ?? item.name ?? item.hash ?? "";
    const current = [{ ...item, depth, resolvedPath }];
    if (Array.isArray(item.children) && item.children.length > 0) {
      return current.concat(flattenArchiveItems(item.children, depth + 1));
    }
    return current;
  });
}

function extractArchiveItems(result?: IArchiveInspectionResult): IArchiveItem[] {
  return (
    result?.entries ??
    result?.contents ??
    result?.files ??
    result?.items ??
    []
  );
}

function archivePathFromLoadOrderEntry(
  entry: ILoadOrderEntry<ICyberpunkLoadOrderData>,
): string | undefined {
  return getCyberpunkArchivePath(entry);
}

function CyberpunkArchiveInspectorPage(): JSX.Element {
  const { api } = useMainContext();
  const profileId = useSelector(
    (state: any) => selectors.activeProfile(state)?.id,
  );
  const loadOrder = useSelector((state: any) =>
    profileId ? currentLoadOrderForProfile(state, profileId) : [],
  ) as ILoadOrderEntry<ICyberpunkLoadOrderData>[];

  const [archivePath, setArchivePath] = React.useState("");
  const [filterText, setFilterText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [inspection, setInspection] = React.useState<IArchiveInspectionResult>();
  const [conflicts, setConflicts] = React.useState<InternalGameConflict[]>([]);

  const archiveEntries = loadOrder.filter((entry) =>
    ["archive", "redmod"].includes(getCyberpunkBucket(entry as any)),
  );
  const items = flattenArchiveItems(extractArchiveItems(inspection));
  const filteredItems = items.filter((item) => {
    const haystack = [
      item.resolvedPath,
      item.name,
      item.virtualPath,
      item.mappedName,
      item.hash,
      item.type,
      item.bucket,
      item.conflictState,
    ]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();
    return haystack.includes(filterText.toLowerCase());
  });
  const visibleConflicts = conflicts;

  const loadArchive = React.useCallback(
    async (targetPath: string) => {
      const cyberpunk = getCyberpunkApi();
      if (typeof cyberpunk?.inspectArchive !== "function") {
        setError(
          "Cyberpunk archive inspector is unavailable in the main-process API.",
        );
        return;
      }

      const runtime = buildCyberpunkRuntimeSnapshot(api);
      const targetEntry = archiveEntries.find((entry) =>
        archivePathFromLoadOrderEntry(entry)?.toLowerCase() === targetPath.toLowerCase(),
      );
      setLoading(true);
      setError(undefined);
      try {
        const [nextInspection, nextConflicts] = await Promise.all([
          cyberpunk.inspectArchive(runtime, targetEntry?.modId),
          typeof cyberpunk.scanConflicts === "function"
            ? cyberpunk.scanConflicts(runtime)
            : Promise.resolve([]),
        ]);
        setInspection(nextInspection);
        setConflicts(nextConflicts ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to inspect archive.");
      } finally {
        setLoading(false);
      }
    },
    [api, archiveEntries],
  );

  const selectArchive = React.useCallback(
    async (targetPath: string) => {
      setArchivePath(targetPath);
      window.localStorage.setItem(
        CYBERPUNK_ARCHIVE_SELECTION_KEY,
        targetPath,
      );
      await loadArchive(targetPath);
    },
    [loadArchive],
  );

  React.useEffect(() => {
    const initialSelection = window.localStorage.getItem(
      CYBERPUNK_ARCHIVE_SELECTION_KEY,
    );
    const fallbackSelection = archiveEntries
      .map((entry) => archivePathFromLoadOrderEntry(entry))
      .find((entry) => entry !== undefined);
    const nextPath = initialSelection ?? fallbackSelection ?? "";
    if (nextPath && nextPath !== archivePath) {
      void selectArchive(nextPath);
    }
  }, [archiveEntries, archivePath, selectArchive]);

  const onBrowse = React.useCallback(async () => {
    try {
      const selected = await api.selectFile({
        title: "Select Cyberpunk archive",
        filters: [{ name: "Cyberpunk archive", extensions: ["archive"] }],
      });
      if (selected) {
        await selectArchive(selected);
      }
    } catch (err) {
      api.showErrorNotification("Failed to pick archive", err, {
        allowReport: false,
      });
    }
  }, [api, selectArchive]);

  const onRefresh = React.useCallback(() => {
    if (archivePath) {
      void loadArchive(archivePath);
    }
  }, [archivePath, loadArchive]);

  return (
    <div style={{ padding: "16px" }}>
      <h2>Cyberpunk archive inspector</h2>
      <p>
        Read-only inspection for Cyberpunk `.archive` files. Use this to inspect contents,
        spot conflicts, and jump between files and load-order entries without converting
        authored packages.
      </p>

      <Panel>
        <Panel.Body>
          <InputGroup>
            <FormControl
              type="text"
              value={archivePath}
              placeholder="Select a Cyberpunk archive to inspect"
              onChange={(evt: any) =>
                setArchivePath(evt.target?.value ?? "")
              }
            />
            <InputGroup.Button>
              <Button bsStyle="default" onClick={onBrowse}>
                Browse
              </Button>
            </InputGroup.Button>
            <InputGroup.Button>
              <Button bsStyle="primary" onClick={onRefresh} disabled={!archivePath}>
                Refresh
              </Button>
            </InputGroup.Button>
          </InputGroup>

          <div style={{ marginTop: "12px" }}>
            <strong>Known load-order archives</strong>
            <div style={{ marginTop: "8px" }}>
              {archiveEntries.length > 0 ? (
                archiveEntries.map((entry) => {
                  const nextArchivePath = archivePathFromLoadOrderEntry(entry);
                  const bucket = formatCyberpunkBucket(getCyberpunkBucket(entry as any));
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "4px 0",
                      }}
                    >
                      <span>
                        <strong>{entry.name ?? entry.id}</strong>{" "}
                        <small>({bucket})</small>
                      </span>
                      <span>
                        {nextArchivePath ? (
                          <Button
                            bsStyle="link"
                            bsSize="xsmall"
                            onClick={() => void selectArchive(nextArchivePath)}
                          >
                            Inspect
                          </Button>
                        ) : (
                          <small>no archive path recorded</small>
                        )}
                      </span>
                    </div>
                  );
                })
              ) : (
                <EmptyPlaceholder
                  icon="archive"
                  text="No Cyberpunk archives are currently known"
                  subtext="Manage Cyberpunk mods and revisit this page after deploying."
                />
              )}
            </div>
          </div>
        </Panel.Body>
      </Panel>

      <Panel>
        <Panel.Body>
          <InputGroup>
            <FormControl
              type="text"
              value={filterText}
              placeholder="Filter paths, names, or file types"
              onChange={(evt: any) =>
                setFilterText(evt.target?.value ?? "")
              }
            />
          </InputGroup>

          {loading ? <Spinner /> : null}
          {error ? <div className="text-danger">{error}</div> : null}

          {!loading && !error ? (
            <div style={{ marginTop: "12px" }}>
              <div style={{ marginBottom: "8px" }}>
                <strong>Archive path:</strong> {archivePath || "none selected"}
              </div>
              <div style={{ marginBottom: "8px" }}>
                <strong>Entries:</strong> {filteredItems.length}
                <strong style={{ marginLeft: "16px" }}>Conflicts:</strong>{" "}
                {visibleConflicts.length}
              </div>

              {filteredItems.length > 0 ? (
                <div>
                  {filteredItems.map((item, idx) => (
                    <div
                      key={`${item.resolvedPath}-${idx}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "6px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div style={{ paddingLeft: `${item.depth * 16}px`, minWidth: 0 }}>
                        <div style={{ fontFamily: "monospace" }}>{item.resolvedPath}</div>
                        <div style={{ opacity: 0.8, fontSize: "12px" }}>
                          {item.type ?? "file"}
                          {item.bucket ? ` | ${formatCyberpunkBucket(item.bucket as any)}` : ""}
                          {item.size !== undefined ? ` | ${item.size} bytes` : ""}
                          {item.hash ? ` | hash ${item.hash}` : ""}
                          {item.conflictState && item.conflictState !== "none"
                            ? ` | ${item.conflictState}`
                            : ""}
                        </div>
                      </div>
                      {item.mappedName ? <div>{item.mappedName}</div> : item.name ? <div>{item.name}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPlaceholder
                  icon="search"
                  text="No entries match the current filter"
                  subtext="Clear the filter or open a different archive."
                />
              )}
            </div>
          ) : null}
        </Panel.Body>
      </Panel>

      <Panel>
        <Panel.Body>
          <h4>Conflicts</h4>
          {visibleConflicts.length > 0 ? (
            visibleConflicts.map((item, idx) => (
              <div
                key={`${item.virtualPath ?? idx}`}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontFamily: "monospace" }}>
                  {item.mappedName ?? item.virtualPath ?? item.hash ?? "unknown hash"}
                </div>
                <div style={{ opacity: 0.8 }}>
                  {item.hash ? `Hash: ${item.hash} | ` : ""}
                  {item.winnerModId ? `Winner: ${item.winnerModId}` : "No explicit winner"}
                  {item.loserModIds.length > 0
                    ? ` | Losers: ${item.loserModIds.join(", ")}`
                    : ""}
                </div>
              </div>
            ))
          ) : (
            <EmptyPlaceholder
              icon="check"
              text="No conflicts reported"
              subtext="If the main-process parser finds conflicts, they will appear here."
            />
          )}
        </Panel.Body>
      </Panel>
    </div>
  );
}

export default CyberpunkArchiveInspectorPage;
