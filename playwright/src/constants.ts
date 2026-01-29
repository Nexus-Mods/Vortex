/**
 * Test configuration constants for Playwright tests
 */

export const constants = {
  /**
   * Test mod configurations for download tests
   * Add more games here as needed for testing
   */
  TEST_MODS: {
    STARDEW_VALLEY: {
      gameId: "stardewvalley",
      modId: 1915,
      fileId: 141974,
    },
  },
} as const;
