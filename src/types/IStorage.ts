export interface IStorage {
  getItem: (key: string, cb: (error: Error, result?: string) => void) => any;
  setItem: (key: string, value: string | number, cb: (error: Error) => void) => void;
  removeItem: (key: string, cb: (error: Error) => void) => void;
  getAllKeys: (cb: (error: Error, keys?: string[]) => void) => void;
}
