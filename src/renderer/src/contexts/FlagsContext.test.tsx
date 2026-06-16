import { act, render, screen } from "@testing-library/react";
import type { FeatureFlag } from "@vortex/shared/flags";
import type { FeatureFlagsApi } from "@vortex/shared/preload";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlagsProvider, useFlag, useFlagsContext } from "./FlagsContext";

const mockOnSynchronize = vi.fn<FeatureFlagsApi["onSynchronize"]>();
const mockUnsubscribe = vi.fn<() => void>();

beforeEach(() => {
  mockUnsubscribe.mockClear();
  mockOnSynchronize.mockClear();
  mockOnSynchronize.mockReturnValue(mockUnsubscribe);
  (window as any).api = {
    log: vi.fn(),
    featureFlags: { onSynchronize: mockOnSynchronize },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

function push(flags: FeatureFlag[]) {
  const callback = mockOnSynchronize.mock.calls[0][0];
  act(() => {
    callback(flags);
  });
}

describe("FlagsProvider", () => {
  it("subscribes to onSynchronize on mount", () => {
    render(
      <FlagsProvider>
        <span />
      </FlagsProvider>,
    );
    expect(mockOnSynchronize).toHaveBeenCalledOnce();
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = render(
      <FlagsProvider>
        <span />
      </FlagsProvider>,
    );
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("provides empty flags before any push", () => {
    let capturedSize = -1;
    function Spy() {
      capturedSize = useFlagsContext().flags.size;
      return null;
    }
    render(
      <FlagsProvider>
        <Spy />
      </FlagsProvider>,
    );
    expect(capturedSize).toBe(0);
  });

  it("updates flags map after a push", () => {
    const sizes: number[] = [];
    function Spy() {
      sizes.push(useFlagsContext().flags.size);
      return null;
    }
    render(
      <FlagsProvider>
        <Spy />
      </FlagsProvider>,
    );
    push([{ name: "vortex-test-flag" }]);
    expect(sizes.at(-1)).toBe(1);
  });

  it("replaces flags on subsequent pushes", () => {
    const sizes: number[] = [];
    function Spy() {
      sizes.push(useFlagsContext().flags.size);
      return null;
    }
    render(
      <FlagsProvider>
        <Spy />
      </FlagsProvider>,
    );
    push([{ name: "vortex-test-flag" }]);
    push([]);
    expect(sizes.at(-1)).toBe(0);
  });
});

describe("useFlag", () => {
  it("returns undefined before first push", () => {
    let captured: ReturnType<typeof useFlag<"vortex-test-flag">> = { name: "vortex-test-flag" };
    function Spy() {
      captured = useFlag("vortex-test-flag");
      return null;
    }
    render(
      <FlagsProvider>
        <Spy />
      </FlagsProvider>,
    );
    expect(captured).toBeUndefined();
  });

  it("returns the flag after it is pushed", () => {
    const flag: FeatureFlag = {
      name: "vortex-test-flag",
      variant: { name: "variant-1", data: 42 },
    };
    const captured: Array<ReturnType<typeof useFlag<"vortex-test-flag">>> = [];
    function Spy() {
      captured.push(useFlag("vortex-test-flag"));
      return null;
    }
    render(
      <FlagsProvider>
        <Spy />
      </FlagsProvider>,
    );
    push([flag]);
    expect(captured.at(-1)).toEqual(flag);
  });

  it("returns undefined when the flag is absent from the latest push", () => {
    const captured: Array<ReturnType<typeof useFlag<"vortex-test-flag">>> = [];
    function Spy() {
      captured.push(useFlag("vortex-test-flag"));
      return null;
    }
    render(
      <FlagsProvider>
        <Spy />
      </FlagsProvider>,
    );
    push([{ name: "vortex-test-flag" }]);
    expect(captured.at(-1)).toBeDefined();
    push([]);
    expect(captured.at(-1)).toBeUndefined();
  });

  it("re-renders a component when flags change", () => {
    function Indicator() {
      const flag = useFlag("vortex-test-flag");
      return <span data-testid="val">{flag ? "on" : "off"}</span>;
    }

    render(
      <FlagsProvider>
        <Indicator />
      </FlagsProvider>,
    );
    expect(screen.getByTestId("val").textContent).toBe("off");

    push([{ name: "vortex-test-flag" }]);
    expect(screen.getByTestId("val").textContent).toBe("on");
  });
});

describe("getFlag", () => {
  it("returns the flag typed by name", () => {
    const flag: FeatureFlag = {
      name: "vortex-test-flag",
      variant: { name: "variant-2", data: 7 },
    };
    let got: ReturnType<typeof useFlag<"vortex-test-flag">> = undefined;
    function Spy() {
      got = useFlagsContext().getFlag("vortex-test-flag");
      return null;
    }
    render(
      <FlagsProvider>
        <Spy />
      </FlagsProvider>,
    );
    push([flag]);
    expect(got?.name).toBe("vortex-test-flag");
    expect(got?.variant).toEqual({ name: "variant-2", data: 7 });
  });
});
