import { EventEmitter } from "events";

import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { afterEach, describe, expect, test, vi } from "vitest";

import { setUserInfo } from "@/extensions/nexus_integration/actions/persistent";
import { persistentReducer } from "@/extensions/nexus_integration/reducers/persistent";
import type { IValidateKeyDataV2 } from "@/extensions/nexus_integration/types/IValidateKeyData";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import { HealthCheckTrackingProvider } from "../../hooks/HealthCheckTracking.context";
import { PremiumModal } from "./PremiumModal";

afterEach(() => {
  cleanup();
});

const FREE = { isPremium: false, isSupporter: false } as IValidateKeyDataV2;

/** Renders the modal over a membership the test can change. */
function renderModal(userInfo: IValidateKeyDataV2, onClose: () => void) {
  // the real reducer and action, so a change to either is caught here
  const nexusReducers = persistentReducer.reducers as Record<
    string,
    (state: unknown, payload: unknown) => unknown
  >;
  const store = createStore(
    (
      state: IState = {
        persistent: { nexus: { ...persistentReducer.defaults, userInfo } },
      } as unknown as IState,
      action: { type: string; payload?: unknown },
    ) => {
      const reducer = nexusReducers[action.type];
      return reducer === undefined
        ? state
        : ({
            ...state,
            persistent: {
              ...state.persistent,
              nexus: reducer(state.persistent["nexus"], action.payload),
            },
          } as IState);
    },
  );

  // the modal reports its own analytics, which need the tracker in context; the events
  // themselves are the tracking suite's business, not this one's
  const api = { events: new EventEmitter() } as unknown as IExtensionApi;

  render(
    <Provider store={store}>
      <HealthCheckTrackingProvider api={api}>
        <PremiumModal trigger="single_install" onClose={onClose} onDownload={vi.fn()} />
      </HealthCheckTrackingProvider>
    </Provider>,
  );

  return {
    upgradeTo: (next: IValidateKeyDataV2) => {
      act(() => {
        store.dispatch(setUserInfo(next));
      });
    },
  };
}

describe("PremiumModal", () => {
  test("stays open for a free user", () => {
    const onClose = vi.fn();

    renderModal(FREE, onClose);

    expect(onClose).not.toHaveBeenCalled();
  });

  // the user upgrades on the website and comes back to a membership the page has re-read; an
  // upsell left in front of a button that now works reads as if the upgrade didn't take (LAZ-838)
  test("closes once the user is no longer shown premium ads", () => {
    const onClose = vi.fn();
    const { upgradeTo } = renderModal(FREE, onClose);

    upgradeTo({ isPremium: true, isSupporter: false } as IValidateKeyDataV2);

    expect(onClose).toHaveBeenCalled();
  });

  test("closes for a supporter, who sees no ads either", () => {
    const onClose = vi.fn();
    const { upgradeTo } = renderModal(FREE, onClose);

    upgradeTo({ isPremium: false, isSupporter: true } as IValidateKeyDataV2);

    expect(onClose).toHaveBeenCalled();
  });
});
