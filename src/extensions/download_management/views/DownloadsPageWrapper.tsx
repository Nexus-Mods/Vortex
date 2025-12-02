import * as React from 'react';
import { useSelector } from 'react-redux';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { IDownload } from '../types/IDownload';

// Lazy load both components for code splitting
const DownloadView = React.lazy(() => import('./DownloadView'));
const DownloadsPageNext = React.lazy(() => import('./DownloadsPageNext'));

export interface IDownloadsPageWrapperProps {
  active: boolean;
  secondary: boolean;
  columns: (props: () => any) => Array<ITableAttribute<IDownload>>;
  downloadPathForGame: (game: string) => string;
}

/**
 * Wrapper component that conditionally renders either the legacy DownloadView
 * or the new Tailwind-based DownloadsPageNext based on the --feature-ui CLI flag.
 */
function DownloadsPageWrapper(props: IDownloadsPageWrapperProps) {
  const featureUi = useSelector(
    (state: IState) => (state.session?.base?.commandLine as any)?.featureUi ?? false
  );

  // Simple loading fallback
  const fallback = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#888',
    }}>
      Loading...
    </div>
  );

  return (
    <React.Suspense fallback={fallback}>
      {featureUi ? (
        <DownloadsPageNext {...props} />
      ) : (
        <DownloadView {...props} />
      )}
    </React.Suspense>
  );
}

export default DownloadsPageWrapper;
