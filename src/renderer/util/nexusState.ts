import type { IValidateKeyDataV2 } from "../../extensions/nexus_integration/types/IValidateKeyData";
import type { IState } from "../types/IState";

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

export const hasNexusPersistent = (
  statePersistent: IStatePersistent,
): statePersistent is IStatePersistentWithNexus => {
  return (
    "nexus" in statePersistent &&
    typeof statePersistent.nexus === "object" &&
    statePersistent.nexus !== null
  );
};

export const hasNexusConfidential = (
  stateConfidential: IStateConfidential,
): stateConfidential is IStateConfidentialWithNexus => {
  return (
    "nexus" in stateConfidential.account &&
    typeof stateConfidential.account.nexus === "object" &&
    stateConfidential.account.nexus !== null
  );
};
