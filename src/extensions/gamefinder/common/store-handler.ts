import type { Result } from "neverthrow";
import type { Game } from "./game";

/**
 * Error types that can occur when finding games
 */
export interface GameFinderError {
  /**
   * Error code for programmatic handling
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Optional underlying error
   */
  cause?: Error;
}

/**
 * Interface for store handlers that find games from a specific platform
 */
export interface StoreHandler {
  /**
   * The store this handler manages
   */
  readonly storeName: string;

  /**
   * Find all games installed from this store
   */
  findAllGames(): Promise<Result<Game[], GameFinderError>>;

  /**
   * Check if this store is available/installed on the system
   */
  isAvailable(): Promise<boolean>;
}
