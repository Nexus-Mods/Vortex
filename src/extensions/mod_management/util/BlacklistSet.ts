import minimatch from "minimatch";
import { DEPLOY_BLACKLIST } from "../constants";
import { Normalize } from "../../../util/getNormalizeFunc";
import { IGame } from "../../../types/IGame";

export default class BlacklistSet extends Set<string> {
  private mPatterns: string[];
  constructor(blacklist: string[], game: IGame, normalize: Normalize) {
    super(blacklist.map((iter) => normalize(iter)));
    this.mPatterns = [].concat(
      DEPLOY_BLACKLIST,
      game.details?.ignoreDeploy ?? [],
    );
  }

  public has(value: string): boolean {
    return (
      super.has(value) ||
      this.mPatterns.find((pat) => minimatch(value, pat, { nocase: true })) !==
        undefined
    );
  }
}
