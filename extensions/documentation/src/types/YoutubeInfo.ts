export interface IVideoAttribution {
  author: string;
  link: string;
}

export interface IYoutubeInfo {
  // id to differentiate between different video instances
  id: number;

  // The youtube id of the video we want to embed.
  ytId: string;

  // The name of the video; will be displayed as the popover's title
  name: string;

  // The start and end times of the video slice we want to display
  //  We're expecting a string in the "MM:SS, M:SS, M.SS, MM.SS" format.
  //  OR a number in seconds.
  start: string | number;
  end: string | number;

  // Used to associate this video tutorial to a specific icon group.
  group: string;

  // attribution to the creator of the video
  attribution: IVideoAttribution;
}

export let nextId = 0;

export function createTutorialVideo(ytId: string,
                                    name: string,
                                    start: string | number,
                                    end: string | number,
                                    attribution: IVideoAttribution,
                                    group?: string): IYoutubeInfo {
  return { id: nextId++, ytId, name, start, end, attribution, group: group || 'Tutorials' };
}

export default IYoutubeInfo;
