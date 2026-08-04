/**
 * Membership bought on the website is invisible to Vortex until it asks, which is what
 * left the health check showing the upsell to people who had just paid for premium.
 */
import { render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { usePremiumStatusRefresh } from "./usePremiumStatusRefresh";

const Harness = ({ api, armed }: { api: IExtensionApi; armed: boolean }) => {
  usePremiumStatusRefresh(api, armed);

  return null;
};

const makeApi = () => ({ events: { emit: vi.fn() } }) as unknown as IExtensionApi;

const regainFocus = () => window.dispatchEvent(new Event("focus"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePremiumStatusRefresh", () => {
  it("re-checks the membership on focus, but only once armed", () => {
    const api = makeApi();
    const { rerender } = render(<Harness api={api} armed={false} />);

    regainFocus();
    expect(api.events.emit).not.toHaveBeenCalled();

    rerender(<Harness api={api} armed={true} />);
    regainFocus();
    expect(api.events.emit).toHaveBeenCalledWith("refresh-user-info");
  });

  it("stops watching once the upsell is dismissed", () => {
    // Asserted on the listener rather than by firing another focus event: the refresh is
    // debounced across every premium surface, so the test above has already spent the
    // window and a second event would prove nothing.
    const removeListener = vi.spyOn(window, "removeEventListener");
    const api = makeApi();
    const { rerender } = render(<Harness api={api} armed={true} />);

    rerender(<Harness api={api} armed={false} />);

    expect(removeListener).toHaveBeenCalledWith("focus", expect.any(Function));
  });
});
