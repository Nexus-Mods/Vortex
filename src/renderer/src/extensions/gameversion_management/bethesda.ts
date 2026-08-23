import type { IGameVersionTransitionProvider } from "./types/IGameVersionTransitionProvider";

const bethesdaProvider: IGameVersionTransitionProvider = {
  id: "bethesda-v1",
  priority: 100,
  supportedGames: ["skyrimse", "fallout4", "skyrimvr", "fallout4vr"],
  supportedStores: ["steam"],
  supportedPlatforms: ["win32"],
  catalog: {
    url: "https://raw.githubusercontent.com/Nexus-Mods/Vortex-Backend/main/out/game-versioning/bethesda-v1.json",
    trustedKeys: {
      "bethesda-v1-2026-08": "MCowBQYDK2VwAyEAyDjA758LrNa6y4LKSnqYcSojp02e5Ik83vBK91bHIUM=",
    },
  },
  launchMode: "direct",
};

export default bethesdaProvider;
