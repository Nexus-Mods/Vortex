// Kept import-free so the download-info shape can be unit-tested without a vortex-api mock.

export function buildGithubDownloadInfo(gameId: string) {
  return {
    game: gameId,
    name: "BepInEx",
    // BepInEx is fetched from github.com/BepInEx/BepInEx, not from Nexus. Declaring the
    // source here stops a game-agnostic md5 lookup from re-stamping the download as a Nexus
    // mod when another author has uploaded a byte-identical BepInEx to some mod page.
    // See https://github.com/Nexus-Mods/Vortex/issues/21979.
    source: "website",
  };
}
