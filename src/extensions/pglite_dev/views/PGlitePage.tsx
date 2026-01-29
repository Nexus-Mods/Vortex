/**
 * PGlite Development Page
 * Only visible in development mode
 * Provides a SQL REPL for testing and debugging the PGlite database
 *
 * Uses the pglite-repl webcomponent which bundles its own React 19,
 * avoiding conflicts with Vortex's React 16.
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

interface IPGlitePageState {
  db: PGlite | null;
  error: string | null;
  loading: boolean;
  webComponentLoaded: boolean;
}

// Declare the custom element for TypeScript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "pglite-repl": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { theme?: string },
        HTMLElement
      >;
    }
  }
}

class PGlitePage extends React.Component<IPGlitePageProps, IPGlitePageState> {
  private replRef = React.createRef<HTMLElement>();

  constructor(props: IPGlitePageProps) {
    super(props);
    this.state = {
      db: null,
      error: null,
      loading: true,
      webComponentLoaded: false,
    };
  }

  public async componentDidMount() {
    try {
      // Get the shared PGlite instance from the persistor
      const PGlitePersist = (await import("../../../store/PGlitePersist"))
        .default;

      const db = PGlitePersist.getSharedInstance();

      if (!db) {
        throw new Error(
          "PGlite database not initialized. Make sure the app has started properly.",
        );
      }

      // Load the webcomponent script
      await this.loadWebComponent();

      this.setState(
        {
          db,
          loading: false,
          webComponentLoaded: true,
        },
        () => {
          // After state update, connect the db to the webcomponent
          this.connectDbToRepl();
        },
      );
    } catch (err) {
      this.setState({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  }

  public componentDidUpdate(
    _prevProps: IPGlitePageProps,
    prevState: IPGlitePageState,
  ) {
    // Reconnect db if it changed
    if (this.state.db !== prevState.db && this.state.webComponentLoaded) {
      this.connectDbToRepl();
    }
  }

  private async loadWebComponent(): Promise<void> {
    // Check if already loaded
    if (customElements.get("pglite-repl")) {
      return;
    }

    // Load from node_modules
    const webComponentPath = require.resolve(
      "@electric-sql/pglite-repl/webcomponent",
    );
    await import(/* webpackIgnore: true */ webComponentPath);
  }

  private connectDbToRepl(): void {
    const { db } = this.state;
    const replElement = this.replRef.current;

    if (db && replElement) {
      // Set the pg property on the webcomponent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (replElement as any).pg = db;
    }
  }

  public render(): JSX.Element {
    const { db, error, loading, webComponentLoaded } = this.state;

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

            {db && webComponentLoaded && (
              <div
                style={{
                  flex: 1,
                  minHeight: "400px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <pglite-repl ref={this.replRef} theme="dark" />
              </div>
            )}
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }
}

export default PGlitePage;
