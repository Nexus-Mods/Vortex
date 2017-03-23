export interface IToolStored {
  id: string;
  name: string;
  shortName?: string;
  logo: string;
  executable: string;
  parameters: string[];
  environment: { [key: string]: string };
}
