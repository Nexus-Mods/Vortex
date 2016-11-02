
const sUrlExpression = /nxm:\/\/([a-z0-9]+)\/mods\/(\d+)\/files\/(\d+)/i;

class NXMUrl {
  private mGameId: string;
  private mModId: number;
  private mFileId: number;

  constructor(input: string) {
    let matches = input.match(sUrlExpression);
    if ((matches === null) || (matches.length !== 4)) {
      throw Error('invalid nxm url "' + input + '"');
    }
    this.mGameId = matches[1];
    this.mModId = parseInt(matches[2], 10);
    this.mFileId = parseInt(matches[3], 10);
  }

  public get gameId(): string {
    return this.mGameId;
  }

  public get modId(): number {
    return this.mModId;
  }

  public get fileId(): number {
    return this.mFileId;
  }
}

export default NXMUrl;
