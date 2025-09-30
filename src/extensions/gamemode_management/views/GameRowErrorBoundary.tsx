import * as React from 'react';
import { TFunction } from 'i18next';
import { ListGroupItem, Media } from 'react-bootstrap';

interface IErrorBoundaryProps {
  t: TFunction;
  gameName: string;
  children: React.ReactNode;
}

interface IErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for GameRow components to prevent crashes when individual game rows fail
 */
class GameRowErrorBoundary extends React.Component<IErrorBoundaryProps, IErrorBoundaryState> {
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.error('GameRowErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t, gameName } = this.props;
      
      // Render fallback UI when there's an error
      return (
        <ListGroupItem className='game-list-item game-list-error'>
          <Media>
            <Media.Body>
              <Media.Heading>{t('Error loading game: {{gameName}}', { replace: { gameName } })}</Media.Heading>
              <p>{t('This game failed to load properly. Try refreshing the game list or check the logs for more information.')}</p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details style={{ whiteSpace: 'pre-wrap' }}>
                  <summary>{t('Error details')}</summary>
                  {this.state.error.toString()}
                  <br />
                  {this.state.error.stack}
                </details>
              )}
            </Media.Body>
          </Media>
        </ListGroupItem>
      );
    }

    return this.props.children;
  }
}

export default GameRowErrorBoundary;