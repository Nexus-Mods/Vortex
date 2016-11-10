export interface IProgressCallback {
  (received: number, total: number, filePath?: string): void;
}
