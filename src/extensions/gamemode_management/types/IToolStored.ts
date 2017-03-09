export interface IToolStored {
  id: string;
  name: string;
  logo: string;
  executable: string;
  parameters: string[];
  environment: { [key: string]: string };
}
