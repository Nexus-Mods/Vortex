/**
 * Xbox Game Pass-specific types and data structures
 */

import type { Game } from "../../common";

/**
 * Xbox product ID (Identity Name from appxmanifest.xml)
 */
export type XboxProductId = string;

/**
 * Represents a game found via Xbox Game Pass
 */
export interface XboxGame extends Game {
  store: "xbox";

  /**
   * Xbox product ID (Identity Name from appxmanifest.xml)
   */
  productId: XboxProductId;
}
