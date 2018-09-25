import { Tag } from 'bbcode-to-react';
import * as React from 'react';

class YoutubeTag extends Tag {
  public toHTML(): string[] {
    return [`<iframe src="https://www.youtube.com/embed/${this.getContent()}"/>`];
  }

  public toReact() {
    return (
      <iframe src={`https://www.youtube.com/embed/${this.getContent()}`}/>
    );
  }
}

export default YoutubeTag;
