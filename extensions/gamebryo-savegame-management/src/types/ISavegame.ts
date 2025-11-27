export interface ISavegame {
  id: string;
  filePath: string;
  fileSize: number;
  attributes: { [id: string]: any };
}
