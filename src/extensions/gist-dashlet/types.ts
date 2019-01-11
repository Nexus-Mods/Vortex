export interface IAnnouncement {
  date: string,
  description: string,
  severity?: AnnouncementSeverity,
  githublink?: string,
  gameMode?: string,
}

export type AnnouncementSeverity = 'information' | 'warning' | 'critical';