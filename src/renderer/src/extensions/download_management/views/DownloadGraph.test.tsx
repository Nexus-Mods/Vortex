import type { ReactNode } from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const resizeObserverInstances: MockResizeObserver[] = [];

class MockResizeObserver {
  public callback: ResizeObserverCallback;
  public observe = vi.fn();
  public disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverInstances.push(this);
  }
}

vi.mock("../../../controls/ErrorBoundary", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("react-redux", () => ({
  connect: () => (component: React.ComponentType<Record<string, unknown>>) =>
    component,
}));

vi.mock("react-i18next", () => ({
  withTranslation: () => (component: unknown) => component,
  translate: () => (component: unknown) => component,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("recharts", () => ({
  Area: () => null,
  AreaChart: ({ children, height, width }: any) => (
    <div
      data-testid="download-graph-chart"
      data-height={String(height)}
      data-width={String(width)}
    >
      {children}
    </div>
  ),
  CartesianGrid: () => null,
  Label: ({ value }: { value: string }) => <span>{value}</span>,
  ReferenceLine: ({ children }: { children?: ReactNode }) => (
    <div data-testid="download-graph-limit">{children}</div>
  ),
  YAxis: () => null,
}));

import DownloadGraph from "./DownloadGraph";

const Graph = DownloadGraph as unknown as React.ComponentType<{
  t: (key: string) => string;
  maxBandwidth: number;
  speeds: number[];
}>;

const t = (key: string) => key;

afterEach(() => {
  cleanup();
  resizeObserverInstances.length = 0;
  delete (globalThis as any).ResizeObserver;
});

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 320,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 120,
  });
  (globalThis as any).ResizeObserver = MockResizeObserver;
});

describe("DownloadGraph", () => {
  it("updates the chart width when ResizeObserver reports a new size", async () => {
    const { unmount } = render(
      <Graph t={t} maxBandwidth={0} speeds={[1, 2, 3]} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("download-graph-chart")).toHaveAttribute(
        "data-width",
        "320",
      );
    });

    const observer = resizeObserverInstances[0];
    expect(observer.observe).toHaveBeenCalledTimes(1);

    observer.callback(
      [{ contentRect: { width: 512, height: 120 } }] as any,
      observer as any,
    );

    await waitFor(() => {
      expect(screen.getByTestId("download-graph-chart")).toHaveAttribute(
        "data-width",
        "512",
      );
    });

    unmount();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("renders the bandwidth limit label when maxBandwidth constrains the graph", () => {
    render(<Graph t={t} maxBandwidth={100} speeds={[120, 140]} />);

    expect(screen.getByTestId("download-graph-limit")).toHaveTextContent(
      "Bandwidth Limit (see Settings)",
    );
  });
});
