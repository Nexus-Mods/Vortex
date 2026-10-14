import type { IDetectedGame } from "../../types/IDetectedGame";

/**
 * The ids of the detected games the Games page can list, those with a Vortex extension,
 * to tell which a scan newly found.
 */
export function listableDetectedIds(detected: IDetectedGame[]): string[] {
  return detected.filter((game) => game.extension !== undefined).map((game) => game.gameUid);
}
