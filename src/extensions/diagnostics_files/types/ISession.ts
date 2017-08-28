export interface ISession {
  from: string;
  to: string;
  logs: ILog[];
  fullLog: string;
}

export interface ILog {
  text: string;
  type: string;
}
