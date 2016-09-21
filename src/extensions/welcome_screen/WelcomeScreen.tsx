import * as React from 'react';
import { Jumbotron } from 'react-bootstrap';

class WelcomeScreen extends React.Component<{}, {}> {
  public render(): JSX.Element {
    return <Jumbotron className='full-height'>Welcome to Nexus Mod Manager 2</Jumbotron>;
  }
}

export default WelcomeScreen;
