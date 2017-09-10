export interface ISession {
  from: string;
  to: string;
  logs: ILog[];
}

export interface ILog {
  text: string;
  type: string;
}
