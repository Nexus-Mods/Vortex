import IYoutubeInfo, { createTutorialVideo } from "./types/YoutubeInfo";

// Used when generating the embedding link to use within the tutorial popover window.
const YOUTUBE_LINK = "https://www.youtube-nocookie.com/embed/";

// Tutorial buttons which are assigned the todo group will registered as
//  todo items on the dashboard.
export const TODO_GROUP = "todo";

// Array of iconbar groups which can be used to place tutorial buttons.
const ICONBAR_GROUPS = {
  plugins: "gamebryo-plugin-icons",
  mods: "mod-icons",
};

// Regex pattern used to test string timestamps and convert them to number of seconds.
const regexPattern: RegExp = /^([0-5][0-9]|[0-9])(:|\.)[0-5][0-9]$/;

// Map of youtube video ids.
const VIDEO_IDS = {
  intro: "sD9xKao_u30",
  installing: "OrZM9LSuDhU",
  fomods: "dWcHiamHhCA",
  plugins: "BRo8I32ASSw",
  conflicts: "eSkurhkPSyw",
};

const ATTRIBUTIONS = {
  gopher: {
    author: "Gopher",
    link: "https://www.gophersvids.com/",
  },
};

/**
 * The documentation module uses the tutorial data map to populate the UI with tutorial buttons.
 *  - The keys must be set to a valid iconbar group names.
 *  - Use the createTutorialVideo to add tutorial videos.
 */
const TUTORIAL_DATA = {
  [ICONBAR_GROUPS.plugins]: [
    createTutorialVideo(
      VIDEO_IDS.plugins,
      "Data files",
      "1.13",
      "3.35",
      ATTRIBUTIONS.gopher,
      ICONBAR_GROUPS.plugins,
    ),
    createTutorialVideo(
      VIDEO_IDS.plugins,
      "Master files",
      "3.36",
      "6.36",
      ATTRIBUTIONS.gopher,
      ICONBAR_GROUPS.plugins,
    ),
    createTutorialVideo(
      VIDEO_IDS.plugins,
      "Load Order",
      "6.37",
      "9.52",
      ATTRIBUTIONS.gopher,
      ICONBAR_GROUPS.plugins,
    ),
    createTutorialVideo(
      VIDEO_IDS.plugins,
      "LOOT Groups",
      "9.53",
      "17.20",
      ATTRIBUTIONS.gopher,
      ICONBAR_GROUPS.plugins,
    ),
    createTutorialVideo(
      VIDEO_IDS.plugins,
      "Dependencies",
      "17.20",
      "19.28",
      ATTRIBUTIONS.gopher,
      ICONBAR_GROUPS.plugins,
    ),
  ],
  [ICONBAR_GROUPS.mods]: [
    createTutorialVideo(
      VIDEO_IDS.installing,
      "Install Mods",
      "1.02",
      "7.10",
      ATTRIBUTIONS.gopher,
      ICONBAR_GROUPS.mods,
    ),
    createTutorialVideo(
      VIDEO_IDS.fomods,
      "Scripted Installers",
      "0.25",
      "10.41",
      ATTRIBUTIONS.gopher,
      ICONBAR_GROUPS.mods,
    ),
    createTutorialVideo(
      VIDEO_IDS.conflicts,
      "Resolving Conflicts",
      "1.36",
      "11.40",
      ATTRIBUTIONS.gopher,
      ICONBAR_GROUPS.mods,
    ),
  ],
  [TODO_GROUP]: [
    createTutorialVideo(
      VIDEO_IDS.intro,
      "Vortex Introduction",
      "2.05",
      "8.14",
      ATTRIBUTIONS.gopher,
      TODO_GROUP,
    ),
  ],
};

export function getTutorialData(group?: string) {
  if (group && group in TUTORIAL_DATA) {
    return TUTORIAL_DATA[group];
  }

  return TUTORIAL_DATA;
}

function getEmbedLink(
  id: string,
  start: string | number,
  end: string | number,
): string {
  const srcLink = YOUTUBE_LINK;
  let startSeconds: number = 0;
  let endSeconds: number = 0;

  if (typeof start === "number") {
    startSeconds = start;
  } else if (typeof start === "string") {
    startSeconds = convertTimeToSeconds(start);
  } else {
    startSeconds = 0;
  }

  if (typeof end === "number") {
    endSeconds = end;
  } else if (typeof start === "string") {
    endSeconds = convertTimeToSeconds(end);
  } else {
    endSeconds = 0;
  }

  return srcLink + id + "?start=" + startSeconds + "&end=" + endSeconds;
}

/**
 * Time string must respect the MM:SS, or M:SS format or it will be rejected.
 *  '.' instead of ':' will also pass the regex test.
 */
function convertTimeToSeconds(time: string): number {
  if (regexPattern.test(time)) {
    const timeArray = time.split(/(?:\.|\:)+/);
    const totalSeconds = +timeArray[0] * 60 + +timeArray[1];
    return totalSeconds;
  }
}

export default getEmbedLink;
