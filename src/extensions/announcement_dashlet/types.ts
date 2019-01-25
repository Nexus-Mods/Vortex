import { HTTPError } from '../../util/CustomErrors';

export interface IAnnouncement {
  date: string,
  description: string,
  link?: string,
  gameMode?: string,
  icon?: string,
  severity?: AnnouncementSeverity,
  version?: string,
}

export type AnnouncementSeverity = 'information' | 'warning' | 'critical';

export class AnnouncementParseError extends HTTPError {
  private mJSONOutput: string;
  constructor(statusCode: number, message: string, url: string, jsonOutput: string) {
    super(statusCode, message, url);
    this.name = this.constructor.name;
    this.mJSONOutput = jsonOutput;
  }

  public get JSONOutput(): string {
    return this.mJSONOutput;
  }
}