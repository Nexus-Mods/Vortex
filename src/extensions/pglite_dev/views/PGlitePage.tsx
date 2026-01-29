/**
 * PGlite Development Page
 * Only visible in development mode
 * Provides a SQL REPL for testing and debugging the PGlite database
 */

import * as React from "react";
import * as path from "path";
import MainPage from "../../../renderer/views/MainPage";
import getVortexPath from "../../../util/getVortexPath";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { PGlite, Results } from "@electric-sql/pglite";

interface IPGlitePageProps {
  api: IExtensionApi;
}

interface IQueryResult {
  query: string;
  result?: Results<Record<string, unknown>>;
  error?: string;
  duration: number;
}

interface IPGlitePageState {
  db: PGlite | null;
  error: string | null;
  loading: boolean;
  query: string;
  executing: boolean;
  history: IQueryResult[];
}

const EXAMPLE_QUERIES = [
  "SELECT COUNT(*) FROM vortex.state;",
  "SELECT * FROM vortex.state LIMIT 10;",
  "SELECT key FROM vortex.state WHERE key LIKE 'user###%' LIMIT 20;",
  "SELECT key, LENGTH(value) as value_length FROM vortex.state ORDER BY LENGTH(value) DESC LIMIT 10;",
  "SELECT DISTINCT SPLIT_PART(key, '###', 1) as hive FROM vortex.state;",
];

class PGlitePage extends React.Component<IPGlitePageProps, IPGlitePageState> {
  private textareaRef = React.createRef<HTMLTextAreaElement>();

  constructor(props: IPGlitePageProps) {
    super(props);
    this.state = {
      db: null,
      error: null,
      loading: true,
      query: EXAMPLE_QUERIES[0],
      executing: false,
      history: [],
    };
  }

  public async componentDidMount() {
    try {
      const { PGlite } = await import("@electric-sql/pglite");

      const userDataPath = getVortexPath("userData");
      const dbPath = path.join(userDataPath, "state.pglite");

      const db = new PGlite(dbPath);
      await db.waitReady;

      this.setState({
        db,
        loading: false,
      });
    } catch (err) {
      this.setState({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  }

  public async componentWillUnmount() {
    if (this.state.db) {
      await this.state.db.close();
    }
  }

  private executeQuery = async () => {
    const { db, query } = this.state;
    if (!db || !query.trim()) return;

    this.setState({ executing: true });

    const startTime = performance.now();
    try {
      const result = await db.query<Record<string, unknown>>(query);
      const duration = performance.now() - startTime;

      this.setState((prev) => ({
        executing: false,
        history: [
          { query, result, duration } as IQueryResult,
          ...prev.history,
        ].slice(0, 50),
      }));
    } catch (err) {
      const duration = performance.now() - startTime;
      this.setState((prev) => ({
        executing: false,
        history: [
          {
            query,
            error: err instanceof Error ? err.message : String(err),
            duration,
          },
          ...prev.history,
        ].slice(0, 50),
      }));
    }
  };

  private handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.executeQuery();
    }
  };

  private setExampleQuery = (query: string) => {
    this.setState({ query });
    this.textareaRef.current?.focus();
  };

  private renderResults(result: Results<Record<string, unknown>>): JSX.Element {
    if (!result.rows || result.rows.length === 0) {
      return (
        <div style={{ color: "#666", fontStyle: "italic" }}>
          Query executed successfully. {result.affectedRows ?? 0} rows affected.
        </div>
      );
    }

    const columns = result.fields.map((f) => f.name);

    return (
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    border: "1px solid #444",
                    padding: "6px 10px",
                    textAlign: "left",
                    backgroundColor: "#2a2a2a",
                    fontWeight: "bold",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td
                    key={col}
                    style={{
                      border: "1px solid #444",
                      padding: "4px 10px",
                      maxWidth: "400px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={String(row[col] ?? "")}
                  >
                    {String(row[col] ?? "NULL")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: "8px", color: "#888", fontSize: "11px" }}>
          {result.rows.length} row(s) returned
        </div>
      </div>
    );
  }

  public render(): JSX.Element {
    const { db, error, loading, query, executing, history } = this.state;

    return (
      <MainPage id="page-pglite-dev">
        <MainPage.Body>
          <div
            style={{
              padding: "20px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#1e1e1e",
              color: "#d4d4d4",
            }}
          >
            <div style={{ marginBottom: "15px" }}>
              <h3
                style={{
                  marginBottom: "10px",
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#fff",
                }}
              >
                PGlite SQL REPL
              </h3>
              <p style={{ marginBottom: "8px", color: "#888", fontSize: "12px" }}>
                Database: {path.join(getVortexPath("userData"), "state.pglite")}
              </p>
            </div>

            {loading && <div style={{ color: "#888" }}>Loading database...</div>}

            {error && (
              <div
                style={{
                  color: "#f48771",
                  marginBottom: "15px",
                  padding: "10px",
                  backgroundColor: "#3a1d1d",
                  borderRadius: "4px",
                }}
              >
                Error: {error}
              </div>
            )}

            {db && (
              <>
                <div style={{ marginBottom: "10px" }}>
                  <span style={{ color: "#888", fontSize: "11px" }}>
                    Examples:{" "}
                  </span>
                  {EXAMPLE_QUERIES.map((eq, i) => (
                    <button
                      key={i}
                      onClick={() => this.setExampleQuery(eq)}
                      style={{
                        marginRight: "5px",
                        marginBottom: "5px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        backgroundColor: "#333",
                        color: "#9cdcfe",
                        border: "1px solid #444",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                  <textarea
                    ref={this.textareaRef}
                    value={query}
                    onChange={(e) => this.setState({ query: e.target.value })}
                    onKeyDown={this.handleKeyDown}
                    placeholder="Enter SQL query..."
                    style={{
                      flex: 1,
                      minHeight: "80px",
                      padding: "10px",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      backgroundColor: "#2d2d2d",
                      color: "#d4d4d4",
                      border: "1px solid #444",
                      borderRadius: "4px",
                      resize: "vertical",
                    }}
                  />
                  <button
                    onClick={this.executeQuery}
                    disabled={executing || !query.trim()}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: executing ? "#444" : "#0e639c",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: executing ? "wait" : "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {executing ? "..." : "Run"}
                  </button>
                </div>

                <div style={{ color: "#888", fontSize: "11px", marginBottom: "10px" }}>
                  Press Ctrl+Enter to execute
                </div>

                <div
                  style={{
                    flex: 1,
                    overflow: "auto",
                    backgroundColor: "#252526",
                    borderRadius: "4px",
                    padding: "10px",
                  }}
                >
                  {history.length === 0 ? (
                    <div style={{ color: "#666", fontStyle: "italic" }}>
                      No queries executed yet
                    </div>
                  ) : (
                    history.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: "20px",
                          paddingBottom: "15px",
                          borderBottom: "1px solid #333",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: "12px",
                            color: "#9cdcfe",
                            marginBottom: "8px",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.query}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#888",
                            marginBottom: "8px",
                          }}
                        >
                          Executed in {item.duration.toFixed(2)}ms
                        </div>
                        {item.error ? (
                          <div style={{ color: "#f48771" }}>{item.error}</div>
                        ) : item.result ? (
                          this.renderResults(item.result)
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }
}

export default PGlitePage;
