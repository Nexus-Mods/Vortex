import { FileSourceKind, HashType, type GeneratedFileSource } from "@nexusmods/mod-pipeline";
import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../../logging";
import type { IState } from "../../../types/IState";
import { checksum } from "../../../util/checksum";
import { toPortablePath } from "./resolverInput";

/** A file a module or game extension writes during a deployment. */
export interface IGeneratedFile {
  /** absolute */
  destinationPath: string;
  /** the exact bytes the deployment leaves there */
  content: Uint8Array;
}

/** Whether a contribution handles a game, by Vortex's game id. */
export type LockfileContributionCondition = (state: IState, gameMode: string) => boolean;

/** Declares the files a module or game extension generates for a game's deployment. */
export type LockfileContribution = (
  state: IState,
  gameMode: string,
  profileId: string,
) => Promise<IGeneratedFile[]>;

interface IRegisteredContribution {
  /** the extension or module that registered it */
  contributor: string;
  condition: LockfileContributionCondition;
  generate: LockfileContribution;
}

/** The registered contributions and the generated files they declare. */
export class LockfileContributions {
  #contributions: IRegisteredContribution[] = [];

  public register(
    contributor: string,
    condition: LockfileContributionCondition,
    generate: LockfileContribution,
  ): void {
    this.#contributions.push({ contributor, condition, generate });
  }

  /** Files the game's contributions declare; a failing one is skipped, a shared path rejects. */
  public async generatedFiles(
    state: IState,
    gameMode: string,
    profileId: string,
  ): Promise<GeneratedFileSource[]> {
    const declared = await Promise.all(
      this.#contributions.map(async ({ contributor, condition, generate }) => {
        try {
          const files = condition(state, gameMode)
            ? await generate(state, gameMode, profileId)
            : [];
          return { contributor, files };
        } catch (err) {
          log("warn", "lockfile contribution failed", {
            contributor,
            gameMode,
            error: getErrorMessageOrDefault(err),
          });
          return { contributor, files: [] };
        }
      }),
    );
    const contributorByDestination = new Map<string, string>();
    return declared.flatMap(({ contributor, files }) =>
      files.map(({ destinationPath, content }) => {
        const portablePath = toPortablePath(destinationPath);
        const declaredBy = contributorByDestination.get(portablePath);
        if (declaredBy !== undefined) {
          throw new Error(`${portablePath} is declared by both ${declaredBy} and ${contributor}`);
        }
        contributorByDestination.set(portablePath, contributor);
        return {
          source: FileSourceKind.VortexGenerated,
          destinationPath: portablePath,
          fileHash: checksum(Buffer.from(content)),
          hashType: HashType.Md5,
        };
      }),
    );
  }
}
