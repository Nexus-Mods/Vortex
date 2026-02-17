/**
 * Tailwind Development Page
 * Only visible in development mode
 * Shows all Tailwind components and demos for testing
 */

import * as React from "react";

import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";

import { ButtonDemo } from "../../../renderer/tailwind/components/next/button/ButtonDemo";
import { CollectionTileDemo } from "../../../renderer/tailwind/components/next/collectiontile/CollectionTileDemo";
import {
  InputDemo,
  SelectDemo,
} from "../../../renderer/tailwind/components/next/form";
import { TabsDemo } from "../../../renderer/tailwind/components/next/tabs/TabsDemo";
import { TypographyDemo } from "../../../renderer/tailwind/components/next/typography/TypographyDemo";
import { TailwindTest } from "../../../renderer/tailwind/components/TailwindTest";
import MainPage from "../../../renderer/views/MainPage";

interface ITailwindPageProps {
  // Props passed from extension context
  api: IExtensionApi;
}

class TailwindPage extends React.Component<ITailwindPageProps> {
  public render(): JSX.Element {
    return (
      <MainPage id="page-tailwind-dev">
        <MainPage.Body>
          <div
            style={{
              padding: "20px",
              overflowY: "auto",
              height: "100%",
            }}
          >
            <div style={{ marginBottom: "40px" }}>
              <h3
                style={{
                  marginBottom: "20px",
                  fontSize: "24px",
                  fontWeight: "bold",
                }}
              >
                🧪 Tailwind v4 Component Testing
              </h3>

              <p style={{ marginBottom: "20px", color: "#666" }}>
                This page is only visible in development mode and provides a
                testing ground for Tailwind components adapted from the web
                team's "next" project.
              </p>
            </div>

            {/* Typography Demo from web team */}
            <TypographyDemo />

            {/* Divider */}
            <div style={{ margin: "60px 0", borderTop: "2px solid #e5e7eb" }} />

            {/* Button Demo from web team */}
            <ButtonDemo />

            {/* Hover overlays */}
            <div className="grid grid-cols-3 gap-4">
              <div className="hover-overlay rounded-sm bg-primary-moderate p-4">
                div overlay light
              </div>

              <a className="hover-overlay block rounded-sm bg-primary-moderate p-4">
                link overlay light
              </a>

              <button className="hover-overlay block rounded-sm bg-primary-moderate p-4">
                button overlay light
              </button>

              <div className="hover-dark-overlay rounded-sm bg-primary-moderate p-4">
                div overlay dark
              </div>

              <a className="hover-dark-overlay block rounded-sm bg-primary-moderate p-4">
                link overlay dark
              </a>

              <button className="hover-dark-overlay block rounded-sm bg-primary-moderate p-4">
                button overlay dark
              </button>
            </div>

            {/* Input Demo from web team */}
            <InputDemo />

            {/* Select Demo from web team */}
            <SelectDemo />

            {/* Divider */}
            <div style={{ margin: "60px 0", borderTop: "2px solid #e5e7eb" }} />

            {/* Tabs Demo from web team */}
            <TabsDemo />

            {/* Divider */}
            <div style={{ margin: "60px 0", borderTop: "2px solid #e5e7eb" }} />

            {/* CollectionTile Demo from web team */}
            <CollectionTileDemo api={this.props.api} />
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }
}

export default TailwindPage;
