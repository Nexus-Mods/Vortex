export interface IMOTMEntry {
  /**
   * Generated ID for the video 
   */
  id: string;
  
  /**
   * YouTube id of the video
   */
  videoid: string;

  /**
   * timestamp of the video
   */
  date: number;
}

export interface IMOTMEntryExt extends IMOTMEntry {
  
  /**
   * Generated YouTube embed link
   * @example https://www.youtube.com/embed/abc123
   */
  link: string;
  
  /**
   * name of the month
   * @example January
   */
  month: string;
  
  /**
   * year of the video
   * @example 2024
   */
  year: string;
}

export type ModSpotlightEntry = IMOTMEntry;
export type ModSpotlightEntryExt = IMOTMEntryExt;
export type VideoEntryType = 'modsofthemonth' | 'modspotlights';