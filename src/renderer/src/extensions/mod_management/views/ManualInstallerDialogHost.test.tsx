import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VortexGameId } from "@vortex/shared";
import React from "react";
import { Provider } from "react-redux";
import { combineReducers, createStore } from "redux";
import { createReducer } from "redux-act";
import { describe, expect, it, vi } from "vitest";

import {
  dequeueManualInstallerRequest,
  enqueueManualInstallerRequest,
} from "../actions/manualInstaller";
import { manualInstallerReducer, type IManualInstallerRequest } from "../reducers/manualInstaller";
import { ManualInstallerDialogHost } from "./ManualInstallerDialogHost";

vi.mock("../selectors", () => ({ modNameByStagingFolder: () => new Map() }));

const request = (id: string): IManualInstallerRequest => ({
  id,
  gameId: VortexGameId("game"),
  modName: id,
  remaining: 0,
  gameFolder: "",
  files: [],
  ownStagingFolders: [],
});

describe("ManualInstallerDialogHost", () => {
  it("answers the next request after the first one was answered", async () => {
    const store = createStore(
      combineReducers({
        session: combineReducers({
          manualInstaller: createReducer(
            manualInstallerReducer.reducers,
            manualInstallerReducer.defaults,
          ),
        }),
      }),
    );
    store.dispatch(enqueueManualInstallerRequest(request("first")));
    store.dispatch(enqueueManualInstallerRequest(request("second")));
    const onAnswer = vi.fn();

    render(
      <Provider store={store}>
        <ManualInstallerDialogHost
          visible
          loadManifest={vi.fn().mockResolvedValue({ version: 1, instance: "i", files: [] })}
          onAnswer={onAnswer}
        />
      </Provider>,
    );

    await userEvent.click(await screen.findByTestId("manual-installer-install"));
    expect(onAnswer).toHaveBeenLastCalledWith("first", expect.anything());

    // what answering the request does in the queue; nothing else re-renders the dialog
    act(() => {
      store.dispatch(dequeueManualInstallerRequest("first"));
    });

    await userEvent.click(await screen.findByTestId("manual-installer-install"));
    expect(onAnswer).toHaveBeenLastCalledWith("second", expect.anything());
  });
});
