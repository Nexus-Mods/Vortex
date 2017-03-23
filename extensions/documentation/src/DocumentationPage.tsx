import * as React from 'react';

class DocumentationPage extends React.Component<{}, {}> {
  public render(): JSX.Element {
    return <webview
      style={{ width: '100%', height: '100%' }}
      src='http://wiki.nexusmods.com/index.php/Main_Page'
    />;
  }
}

export default DocumentationPage;
