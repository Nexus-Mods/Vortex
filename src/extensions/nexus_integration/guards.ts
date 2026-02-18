import type { IValidateKeyDataV2 } from "./types/IValidateKeyData";
import type { IState } from "../../renderer/types/IState";

type IStatePersistent = IState["persistent"];
type IStateConfidential = IState["confidential"];

export interface IStatePersistentWithNexus extends IStatePersistent {
  nexus: {
    userInfo?: IValidateKeyDataV2;
  };
}

export interface IStateConfidentialWithNexus extends IStateConfidential {
  account: {
    nexus?: {
      APIKey?: string;
      OAuthCredentials?: unknown;
    };
  };
}

export const hasPersistentWithNexus = (
  statePersistent: IStatePersistent,
): statePersistent is IStatePersistentWithNexus => {
  return (
    "nexus" in statePersistent &&
    typeof statePersistent.nexus === "object" &&
    statePersistent.nexus !== null
  );
};

export const hasConfidentialWithNexus = (
  stateConfidential: IStateConfidential,
): stateConfidential is IStateConfidentialWithNexus => {
  return (
    "nexus" in stateConfidential.account &&
    typeof stateConfidential.account.nexus === "object" &&
    stateConfidential.account.nexus !== null
  );
};
