import minimatch from "minimatch";
import { DEPLOY_BLACKLIST } from "../constants";
import type { Normalize } from "../../../util/getNormalizeFunc";
import type { IGame } from "../../../types/IGame";

export default class BlacklistSet extends Set<string> {
  private mPatterns: string[];
  constructor(blacklist: string[], game: IGame, normalize: Normalize) {
    super(blacklist.filter((x) => !!x).map((iter) => normalize(iter)));
    const patterns = DEPLOY_BLACKLIST.concat(game.details?.ignoreDeploy ?? []);
    this.mPatterns = patterns.filter((x) => !!x).map((iter) => normalize(iter));
  }

  public has(value: string): boolean {
    if (!value) {
      return false;
    }
    try {
      return (
        super.has(value) ||
        this.mPatterns.some((pat) => minimatch(value, pat, { nocase: true }))
      );
    } catch {
      return false;
    }
  }
}
