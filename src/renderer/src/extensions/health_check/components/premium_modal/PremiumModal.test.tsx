import { EventEmitter } from "events";

import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { combineReducers, createStore } from "redux";
import { createReducer } from "redux-act";
import { afterEach, describe, expect, test, vi } from "vitest";

import { setUserInfo } from "@/extensions/nexus_integration/actions/persistent";
import { persistentReducer } from "@/extensions/nexus_integration/reducers/persistent";
import type { IValidateKeyDataV2 } from "@/extensions/nexus_integration/types/IValidateKeyData";
import { makeUserInfo } from "@/test-utils/builders";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { HealthCheckTrackingProvider } from "../../hooks/HealthCheckTracking.context";
import { PremiumModal } from "./PremiumModal";

afterEach(() => {
  cleanup();
});

const FREE = makeUserInfo({ isPremium: false });

/**
 * Renders the modal over a membership the test can change, through the real reducer and action so a
 * change to either is caught here. The api harness store can't stand in: it mutates state in place,
 * and useSelector skips a selector whose state is the same object as last time.
 *
 * The modal's selector reads only `persistent.nexus`, so that one slice is all the store needs -
 * hence the single cast, rather than building a whole IState.
 */
function renderModal(userInfo: IValidateKeyDataV2, onClose: () => void) {
  const store = createStore(
    combineReducers({
      persistent: combineReducers({
        nexus: createReducer(persistentReducer.reducers, {
          ...persistentReducer.defaults,
          userInfo,
        }),
      }),
    }),
  );

  // the modal reports its own analytics, which need the tracker in context; the events themselves
  // are the tracking suite's business, not this one's
  const api = { events: new EventEmitter() } as unknown as IExtensionApi;

  render(
    <Provider store={store as never}>
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

    upgradeTo(makeUserInfo({ isPremium: true }));

    expect(onClose).toHaveBeenCalled();
  });

  test("closes for a supporter, who sees no ads either", () => {
    const onClose = vi.fn();
    const { upgradeTo } = renderModal(FREE, onClose);

    upgradeTo(makeUserInfo({ isPremium: false, isSupporter: true }));

    expect(onClose).toHaveBeenCalled();
  });
});
