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
import type { PGlite } from "@electric-sql/pglite";

interface IPGlitePageProps {
  api: IExtensionApi;
}

type ReplTheme = "light" | "dark" | "auto";

interface IPGlitePageState {
  db: PGlite | null;
  error: string | null;
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ReplComponent: React.ComponentType<{ pg: PGlite; theme?: ReplTheme }> | null;
}

class PGlitePage extends React.Component<IPGlitePageProps, IPGlitePageState> {
  constructor(props: IPGlitePageProps) {
    super(props);
    this.state = {
      db: null,
      error: null,
      loading: true,
      ReplComponent: null,
    };
  }

  public async componentDidMount() {
    try {
      // Get the shared PGlite instance from the persistor
      const PGlitePersist = (await import("../../../store/PGlitePersist"))
        .default;
      const { Repl } = await import("@electric-sql/pglite-repl");

      const db = PGlitePersist.getSharedInstance();

      if (!db) {
        throw new Error(
          "PGlite database not initialized. Make sure the app has started properly.",
        );
      }

      this.setState({
        db,
        ReplComponent: Repl,
        loading: false,
      });
    } catch (err) {
      this.setState({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  }

  public componentWillUnmount() {
    // Don't close the shared db instance - it's managed by the persistor
  }

  public render(): JSX.Element {
    const { db, error, loading, ReplComponent } = this.state;

    return (
      <MainPage id="page-pglite-dev">
        <MainPage.Body>
          <div
            style={{
              padding: "20px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ marginBottom: "20px" }}>
              <h3
                style={{
                  marginBottom: "10px",
                  fontSize: "24px",
                  fontWeight: "bold",
                }}
              >
                PGlite SQL REPL
              </h3>
              <p style={{ marginBottom: "10px", color: "#666" }}>
                This page is only visible in development mode. Use it to query
                and debug the PGlite state database.
              </p>
              <p
                style={{
                  marginBottom: "10px",
                  color: "#888",
                  fontSize: "12px",
                }}
              >
                Database: {path.join(getVortexPath("userData"), "state.pglite")}
              </p>
              <p
                style={{
                  marginBottom: "10px",
                  color: "#888",
                  fontSize: "12px",
                }}
              >
                Try: <code>SELECT * FROM vortex.state LIMIT 10;</code> or{" "}
                <code>
                  SELECT key FROM vortex.state WHERE key LIKE 'user%' LIMIT 20;
                </code>
              </p>
            </div>

            {loading && (
              <div style={{ color: "#666" }}>Loading PGlite database...</div>
            )}

            {error && (
              <div style={{ color: "#dc3545", marginBottom: "20px" }}>
                Error: {error}
              </div>
            )}

            {db && ReplComponent && (
              <div
                style={{
                  flex: 1,
                  minHeight: "400px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <ReplComponent pg={db} theme="dark" />
              </div>
            )}
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }
}

export default PGlitePage;
