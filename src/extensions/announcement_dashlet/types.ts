import { HTTPError } from '../../util/CustomErrors';

export interface IAnnouncement {
  date: string;
  description: string;
  link?: string;
  gamemode?: string;
  severity?: AnnouncementSeverity;
  version?: string;
  title?: string;
}

export interface ISurveyInstance {
  // Unique survey ID we can use to keep track of which surveys
  //  the user has clicked on.
  id: string;

  // Survey notification will be displayed up to the specified end date.
  endDate: string;

  // The url of the survey itself.
  link: string;

  // If provided, survey will only be displayed for certain versions
  //  of Vortex.
  version?: string;

  // If provided, survey is only displayed when the user is actively
  //  managing the specified gameId
  gamemode?: string;
}

export type AnnouncementSeverity = 'information' | 'warning' | 'critical';

export class ParserError extends HTTPError {
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
