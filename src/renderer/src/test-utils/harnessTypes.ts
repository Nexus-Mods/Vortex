/**
 * Shared types for the test harnesses and revision fixtures. Kept separate from builders.ts (the
 * factory functions) and the *Test.ts fixture modules so both can import the shapes without pulling
 * in each other's runtime code.
 */
import type { ICollectionMod } from "../extensions/collections/types/ICollection";
import type InstallDriver from "../extensions/collections/util/InstallDriver";
import type { IDownload } from "../extensions/download_management/types/IDownload";
import type InstallManager from "../extensions/mod_management/InstallManager";
import type { IMod, IModRule } from "../extensions/mod_management/types/IMod";
import type { InstallPhaseTracker } from "../extensions/mod_management/util/InstallPhaseTracker";
import type { IProfile } from "../extensions/profile_management/types/IProfile";
import type {
  CollectionModStatus,
  ICollectionInstallState,
} from "../types/collections/ICollectionInstallSession";
import type { DialogType, IDialogResult } from "../types/IDialog";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IState } from "../types/IState";

/** A dispatched redux-act action as the harness sees it. */
export interface ITrackedAction {
  type: string;
  payload?: unknown;
}

/** The redux slices an InstallDriver test arranges, each a builder-style override. */
export interface IDriverHarnessState {
  // installed mods, keyed by gameId then modId (state.persistent.mods)
  mods: Record<string, Record<string, IMod>>;
  // downloads, keyed by download id (state.persistent.downloads.files)
  downloads: Record<string, IDownload>;
  // profiles, keyed by profile id (state.persistent.profiles)
  profiles: Record<string, IProfile>;
  // the install-tracking slice (state.session.collections)
  session: ICollectionInstallState;
}

export interface IApiHarness {
  api: IExtensionApi;
  // every dispatched action, batched actions flattened, in order
  dispatched: ITrackedAction[];
  // emit a global event (runs any registered on/onAsync listeners synchronously)
  emit: (event: string, ...args: unknown[]) => void;
  // read the live fake state
  getState: () => IState;
  // mutate the state mid-test (to model churn between events)
  setState: (mutate: (draft: IState) => void) => void;
  // configure what the next showDialog call resolves to
  setNextDialog: (result: IDialogResult) => void;
  // showDialog calls, recorded in order
  dialogCalls: Array<{ type: DialogType; title: string }>;
}

export interface IDriverHarness extends IApiHarness {
  // the driver under test, constructed against the fake api
  driver: InstallDriver;
}

export interface IInstallManagerHarness extends IApiHarness {
  // the InstallManager under test, constructed against the fake api (its event handlers are wired
  // onto the same bus, so harness.emit drives them)
  manager: InstallManager;
  // the manager's per-collection phase-gating map. The manager keeps it private (the codebase is
  // moving toward #private enforcement), so the harness is the single typed seam that exposes it -
  // suites prime/inspect phase state through this rather than casting the manager per test.
  phaseTracker: InstallPhaseTracker;
}

// One member of a collection revision. `tag` is the member's stable identity: keep the same tag
// across two revisions for a kept member, give it a new tag for an update (deterministic tags
// change when the pinned file changes), drop it for a removal, add a new tag for an addition.
export interface IRevisionMemberSpec {
  tag: string;
  version?: string;
  optional?: boolean;
}

// A collection modelled at one revision: the collection mod carrying its member rules (stamped with
// `revisionNumber`), the installed member mods that satisfy those rules (marked
// installedAsDependency, as the install path stamps them), and the manifest entries the update flow
// turns into rules via collectionModToRule.
export interface IRevisionFixture {
  revisionNumber: number;
  collection: IMod;
  rules: IModRule[];
  installed: IMod[];
  manifestMods: ICollectionMod[];
}

export interface ICollectionHarness extends IDriverHarness {
  // start the real driver.start on `rev` with `present` members on disk (defaults to the revision's
  // own installed set; pass the previous revision's set to model an update/downgrade over an
  // existing install). The driver re-attributes the session against what is present.
  installRevision: (rev: IRevisionFixture, present?: IMod[]) => Promise<void>;
  // mimic the active install finishing: mark every tracked member installed, advance the driver to
  // its review step, then proceed past review to close the session - so the next revision can start,
  // the way a real update/downgrade follows a completed install.
  completeActiveInstall: () => Promise<void>;
  // the active session's status for the member carrying this referenceTag
  memberStatus: (tag: string) => CollectionModStatus | undefined;
}
