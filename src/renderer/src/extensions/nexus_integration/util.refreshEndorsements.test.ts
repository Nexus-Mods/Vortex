import { batch } from "redux-act";
import { describe, expect, vi } from "vitest";

import { test } from "@/test-utils/harnessTest";

import { setExtensionEndorsed, setModAttribute } from "../../actions";
import { refreshEndorsements } from "./util";

/** The endorsements the account holds: two extensions on the site domain, one Skyrim SE mod. */
const ENDORSEMENTS = [
  { domain_name: "site", mod_id: 100, status: "Endorsed" },
  { domain_name: "site", mod_id: 200, status: "Endorsed" },
  { domain_name: "skyrimspecialedition", mod_id: 300, status: "Abstained" },
];

/**
 * A store holding three installed extensions and two mods. `stale` decides whether the stored
 * endorsement values already match ENDORSEMENTS.
 */
const makeStore = (stale: boolean) => {
  const state = {
    app: {
      extensions: {
        "ext-current": { modId: 100, endorsed: "Endorsed" },
        "ext-other": { modId: 200, endorsed: stale ? "Undecided" : "Endorsed" },
        "ext-local": { endorsed: undefined },
      },
    },
    persistent: {
      mods: {
        skyrimse: {
          "mod-endorsed": {
            attributes: { modId: 300, endorsed: stale ? "Endorsed" : "Abstained" },
          },
          "mod-local": { attributes: {} },
        },
      },
    },
    session: { gameMode: { known: [] } },
  };

  return { getState: () => state, dispatch: vi.fn() };
};

const nexusWith = (endorsements: unknown[]) =>
  ({ getEndorsements: vi.fn().mockResolvedValue(endorsements) }) as never;

describe("refreshEndorsements", () => {
  // every change to app.extensions re-renders the pages that select it, so one dispatch per
  // extension froze the app for one render each
  test("sends only the changed values, in a single batch", async () => {
    const store = makeStore(true);

    await refreshEndorsements(store as never, nexusWith(ENDORSEMENTS));

    expect(store.dispatch).toHaveBeenCalledTimes(1);
    expect(store.dispatch).toHaveBeenCalledWith(
      batch([
        setExtensionEndorsed("ext-other", "Endorsed"),
        setModAttribute("skyrimse", "mod-endorsed", "endorsed", "Abstained"),
      ]),
    );
  });

  test("dispatches nothing when every stored value is current", async () => {
    const store = makeStore(false);

    await refreshEndorsements(store as never, nexusWith(ENDORSEMENTS));

    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
