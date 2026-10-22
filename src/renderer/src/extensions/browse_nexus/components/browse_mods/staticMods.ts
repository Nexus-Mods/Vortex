import type { IGalleryImage } from "./mod_details/mod_gallery/ModGallery";

/** Where Skyrim SE's mod art lives on Nexus Mods; `thumbnails/` before the path for the small one. */
export const MOD_IMAGES = "https://staticdelivery.nexusmods.com/mods/1704/images";

/** How many mods the wireframe claims to have found, for the pagination to page through. */
export const STATIC_RESULTS = 121867;

/** One of the design's mods, standing in until there's an API. */
export interface IStaticMod {
  /** Its name. */
  name: string;
  /** Its picture, under `MOD_IMAGES`. */
  image: string;
  /** Who uploaded it. */
  author: string;
  /** Its category. */
  category: string;
  /** Its one-line summary. */
  summary: string;
  /** How many times it's been downloaded. */
  downloads: number;
  /** How many endorsements it has. */
  endorsements: number;
  /** When it was last updated, as an ISO date. */
  updatedAt: string;
  /** When it was first uploaded, as an ISO date. */
  createdAt: string;
  /** Its size, in kilobytes. */
  fileSize: number;
  /** Adult content; set where the design shows it rather than from Nexus Mods. */
  isAdult?: boolean;
}

/** The design's mods, with their details from Nexus Mods. */
export const STATIC_MODS: IStaticMod[] = [
  {
    name: "HorsePower - Modernized Horse Riding (Total Riding Overhaul)",
    image: "169335/169335-1769376557-897828620.png",
    author: "tsptds",
    category: "Gameplay",
    summary:
      "The horse overhaul you've been waiting for! Yes, that one. HorsePower overhauls pretty much everything missing about horse riding in Skyrim. New player followup attacks, directional animations, improved handling, in-place turns, new ragdoll",
    downloads: 1282047,
    endorsements: 3400,
    createdAt: "2026-01-25",
    fileSize: 3,
    updatedAt: "2026-09-01",
    isAdult: true,
  },
  {
    name: "Missives - Voice and Quest Expansion",
    image: "166094/166094-1764859740-647935753.png",
    author: "jayserpa",
    category: "Quests and Adventures",
    summary:
      "Do you enjoy the mod Missives? How would you enjoy 20 new types of Missives? What about more voice variety in NPC responses? I've got you covered!",
    downloads: 695652,
    endorsements: 2204,
    createdAt: "2025-12-05",
    fileSize: 2047,
    updatedAt: "2026-05-20",
  },
  {
    name: "Azurite III CS",
    image: "162153/162153-1760964400-1080397199.jpg",
    author: "Dlizzio",
    category: "Visuals and Graphics",
    summary:
      "Utilizes Community Shaders tonemapping to the fullest extent, delivering ENB-like visuals without the performance tradeoff.",
    downloads: 430486,
    endorsements: 1536,
    createdAt: "2025-10-20",
    fileSize: 8844,
    updatedAt: "2026-07-20",
  },
  {
    name: "Drain Magic VFX Edit",
    image: "164598/164598-1763243627-1014821789.png",
    author: "Kittytail",
    category: "Magic - Spells & Enchantments",
    summary: "New tasty drain visuals!",
    downloads: 418419,
    endorsements: 2029,
    createdAt: "2025-11-15",
    fileSize: 95,
    updatedAt: "2025-11-16",
    isAdult: true,
  },
  {
    name: "Precision - Attack Collision Fixes",
    image: "177313/177313-1776124836-1627712965.jpg",
    author: "AugustGal",
    category: "Gameplay",
    summary:
      "Fixes and tweaks for Precision's attack collision definitions that could lead to issues, such as dual-wield and unarmed combo power attacks producing more hits than intended, and several unarmed attack issues, such as first person sneak",
    downloads: 297401,
    endorsements: 1088,
    createdAt: "2026-04-14",
    fileSize: 97,
    updatedAt: "2026-06-10",
  },
  {
    name: "The Green Den - A Lush Drunken Huntsman Overhaul",
    image: "165520/165520-1764147433-1676604935.jpg",
    author: "fadingsignal",
    category: "Locations - Vanilla",
    summary:
      "A very cozy and lush overhaul to The Drunken Huntsman, bringing a bit of Valenwood to Whiterun, featuring custom high-quality assets. Patches for compatibility with other mods are available.",
    downloads: 644914,
    endorsements: 4588,
    createdAt: "2025-11-26",
    fileSize: 42249,
    updatedAt: "2026-01-15",
    isAdult: true,
  },
  {
    name: "SkyUI",
    image: "12604/12604-1774356382-945468655.png",
    author: "schlangster",
    category: "User Interface",
    summary:
      "Elegant, PC-friendly interface mod with many advanced features. Upgraded with full support for all modern game versions.",
    downloads: 26192146,
    endorsements: 506071,
    createdAt: "2017-10-01",
    fileSize: 2630,
    updatedAt: "2026-05-05",
  },
  {
    name: "Unofficial Skyrim Special Edition Patch - USSEP",
    image: "266-0-1477512662.png",
    author: "Arthmoor",
    category: "Bug Fixes",
    summary:
      "A comprehensive bugfixing mod for The Elder Scrolls V: Skyrim - Special Edition. The goal of the Unofficial Skyrim Special Edition Patch (aka USSEP) is to eventually fix every bug with Skyrim Special Edition not officially resolved by the",
    downloads: 28180747,
    endorsements: 479873,
    createdAt: "2016-10-26",
    fileSize: 164895,
    updatedAt: "2026-09-05",
  },
  {
    name: "Static Mesh Improvement Mod - SMIM",
    image: "8655-1-1344844621.jpg",
    author: "Brumbek",
    category: "Models and Textures",
    summary:
      "A massive project to greatly improve the appearance of countless static 3D models in Skyrim. Basically, this is my attempt to make the Skyrim architecture, clutter, furniture, and landscaping much nicer.",
    downloads: 17356626,
    endorsements: 273631,
    createdAt: "2016-10-29",
    fileSize: 1032370,
    updatedAt: "2025-02-16",
  },
  {
    name: "RaceMenu",
    image: "19080/19080-1776621005-385672924.jpg",
    author: "expired6978",
    category: "User Interface",
    summary:
      "Complete overhaul to the character creation menu including new customization features such as multiple RGBA warpaints, body paints, hand paint, and foot paints. (Requires SKSE)",
    downloads: 22936760,
    endorsements: 270045,
    createdAt: "2018-08-05",
    fileSize: 8455,
    updatedAt: "2026-04-20",
  },
  {
    name: "A Quality World Map",
    image: "5804-1-1481088259.jpg",
    author: "Chesko",
    category: "User Interface",
    summary:
      "Provides a new set of highly-detailed 3D or paper world map textures, complete with roads! Also adds a detailed Solsteim map.",
    downloads: 11875717,
    endorsements: 252914,
    createdAt: "2016-12-07",
    fileSize: 21175,
    updatedAt: "2016-12-11",
  },
  {
    name: "Alternate Start - Live Another Life - SSE",
    image: "9557-1-1401347037.jpg",
    author: "Arthmoor",
    category: "Gameplay",
    summary:
      "Live Another Life provides an alternative means to start the game for those who do not wish to go through the lengthy intro sequence at Helgen.",
    downloads: 11741301,
    endorsements: 240099,
    createdAt: "2016-10-26",
    fileSize: 5295,
    updatedAt: "2026-03-08",
  },
  {
    name: "Immersive Armors",
    image: "3479-0-1478731779.png",
    author: "hothtrooper44",
    category: "Armour",
    summary:
      "Immersive Armors seeks to drastically enhance the variety of armors in the world of Skyrim in a lore friendly way. The goal of every set is to blend into the lore, balance, and feel of the game for the most immersive experience possible.",
    downloads: 9234534,
    endorsements: 209377,
    createdAt: "2016-11-09",
    fileSize: 1067420,
    updatedAt: "2016-11-09",
  },
  {
    name: "Immersive Citizens - AI Overhaul SE",
    image: "65013-0-1432742432.png",
    author: "Shurah",
    category: "Immersion",
    summary:
      "Immersive Citizens - AI Overhaul is a mod whose purpose is to increase player in-game immersion by greatly improving Artificial Intelligence (AI) of friendly NPCs (citizens) in order to make them act and react like true humans in relation",
    downloads: 8034710,
    endorsements: 205449,
    createdAt: "2016-11-01",
    fileSize: 1821,
    updatedAt: "2022-06-21",
  },
  {
    name: "Ordinator - Perks of Skyrim",
    image: "1137-0-1498676465.png",
    author: "EnaiSiaion",
    category: "Overhauls",
    summary:
      "Ordinator overhauls the perk trees of Skyrim to increase the depth and fun of character building. It is highly compatible with other mods and uses lightweight and clean scripting.",
    downloads: 16368548,
    endorsements: 190624,
    createdAt: "2016-10-28",
    fileSize: 11227,
    updatedAt: "2025-10-12",
  },
  {
    name: "Realistic Water Two SE (RWT)",
    image: "41076-1-1377597873.png",
    author: "TechAngel85",
    category: "Environmental",
    summary:
      "Visually crisp and distinct water types and colors, robust improvements to water effects and meshes, improved water textures and new features. Fully compatible with ENBSeries.",
    downloads: 9984701,
    endorsements: 173988,
    createdAt: "2016-11-02",
    fileSize: 90665,
    updatedAt: "2026-07-22",
  },
];

/** Skyrim SE screenshots from Nexus Mods, standing in for the selected mod's gallery. */
const STATIC_SCREENSHOTS = [
  "250116957-1745777127.jpg",
  "56492487-1564931448.png",
  "180634026-1782633084.jpg",
  "66238536-1776153857.jpg",
  "66238536-1778202756.jpg",
];

const SCREENSHOTS = "https://staticdelivery.nexusmods.com/images/1704";

/** A stand-in gallery: the mod's own picture, then screenshots and the other mods' pictures. */
export const galleryFor = (mod: IStaticMod): IGalleryImage[] => [
  { src: `${MOD_IMAGES}/${mod.image}`, thumbnail: `${MOD_IMAGES}/thumbnails/${mod.image}` },
  ...STATIC_SCREENSHOTS.map((image) => ({
    src: `${SCREENSHOTS}/${image}`,
    thumbnail: `${SCREENSHOTS}/thumbnails/${image}`,
  })),
  ...STATIC_MODS.filter((other) => other.image !== mod.image).map((other) => ({
    src: `${MOD_IMAGES}/${other.image}`,
    thumbnail: `${MOD_IMAGES}/thumbnails/${other.image}`,
  })),
];
