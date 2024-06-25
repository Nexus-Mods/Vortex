export interface IMOTMEntry {
  id: string;
  link: string;
  date: number;
}

export interface IMOTMEntryExt extends IMOTMEntry {
  month: string;
  year: string;
}