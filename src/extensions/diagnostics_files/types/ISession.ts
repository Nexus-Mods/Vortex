import {LogLevel} from '../../../util/log';

export interface ISession {
  from: Date;
  to: Date;
  logs: ILog[];
}

export interface ILog {
  lineno: number;
  time: string;
  text: string;
  type: LogLevel;
}
