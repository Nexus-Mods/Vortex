declare module 'esptk' {
  class ESPFile {
    constructor(filePath: string);
    isMaster: boolean;
    isDummy: boolean;
    author: string;
    description: string;
    masterList: string[];
  }
  export default ESPFile;
}