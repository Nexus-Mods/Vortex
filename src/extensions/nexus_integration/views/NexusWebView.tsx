import { IconButton, Button } from '../../../controls/TooltipControls';
import { WebviewOverlay } from '../../../controls/Webview';
import { log } from '../../../util/log';
import { truthy } from '../../../util/util';

import { clipboard } from 'electron';
import * as React from 'react';
import { ButtonGroup, Button as BootstrapButton } from 'react-bootstrap';

interface IProps {
  initialUrl?: string;
  onClose?: () => void;
}

const NexusWebView: React.FC<IProps> = ({ initialUrl = 'https://www.nexusmods.com', onClose }) => {
  const [url, setUrl] = React.useState(initialUrl);
  const [loading, setLoading] = React.useState(false);
  const [canGoBack, setCanGoBack] = React.useState(false);
  const [canGoForward, setCanGoForward] = React.useState(false);
  const [history, setHistory] = React.useState<string[]>([initialUrl]);
  const [historyIndex, setHistoryIndex] = React.useState(0);

  const mWebViewRef = React.useRef<WebviewOverlay>(null);

  const isValidNexusUrl = React.useCallback((url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.includes('nexusmods.com');
    } catch (err) {
      return false;
    }
  }, []);

  const updateNavigationState = React.useCallback(() => {
    setCanGoBack(historyIndex > 0);
    setCanGoForward(historyIndex < history.length - 1);
  }, [history.length, historyIndex]);

  const updateUrl = React.useCallback((newUrl: string) => {
    if (newUrl !== history[historyIndex]) {
      // Add new URL to history, removing any forward history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newUrl);

      setUrl(newUrl);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [history, historyIndex]);

  React.useEffect(() => {
    updateNavigationState();
  }, [updateNavigationState]);

  const onStartLoading = React.useCallback(() => {
    setLoading(true);
  }, []);

  const onStopLoading = React.useCallback(() => {
    setLoading(false);
  }, []);

  const onNavigate = React.useCallback((url: string) => {
    if (!isValidNexusUrl(url)) {
      log('warn', 'Blocked navigation to non-Nexus domain', { url });
      return;
    }
    updateUrl(url);
  }, [isValidNexusUrl, updateUrl]);

  const onNavigateInPage = React.useCallback((url: string) => {
    updateUrl(url);
  }, [updateUrl]);

  const onFinishLoad = React.useCallback(() => {
    updateNavigationState();
  }, [updateNavigationState]);

  const onLoading = React.useCallback((loading: boolean) => {
    setLoading(loading);
  }, []);

  const onNewWindow = React.useCallback((url: string, disposition: string) => {
    if (isValidNexusUrl(url)) {
      // Allow nexusmods.com popups to open in the same view
      setUrl(url);
      if (truthy(mWebViewRef.current)) {
        mWebViewRef.current.loadURL(url);
      }
    } else {
      log('warn', 'Blocked popup to non-Nexus domain', { url, disposition });
    }
  }, [isValidNexusUrl]);

  const goBack = React.useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const newUrl = history[newIndex];

      setHistoryIndex(newIndex);
      setUrl(newUrl);

      if (truthy(mWebViewRef.current)) {
        mWebViewRef.current.loadURL(newUrl);
      }
    }
  }, [history, historyIndex]);

  const goForward = React.useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const newUrl = history[newIndex];

      setHistoryIndex(newIndex);
      setUrl(newUrl);

      if (truthy(mWebViewRef.current)) {
        mWebViewRef.current.loadURL(newUrl);
      }
    }
  }, [history, historyIndex]);

  const refresh = React.useCallback(() => {
    if (truthy(mWebViewRef.current)) {
      const currentUrl = url;
      // Force reload by reloading the URL
      mWebViewRef.current.loadURL(currentUrl);
      log('debug', 'Refreshing webview', { url: currentUrl });
    }
  }, [url]);

  const copyUrlToClipboard = React.useCallback(() => {
    clipboard.writeText(url);
    log('info', 'URL copied to clipboard', { url });
  }, [url]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        borderBottom: '1px solid #ccc',
        backgroundColor: '#f8f9fa'
      }}>
        <ButtonGroup style={{ marginRight: '10px' }}>
          <IconButton
            icon='nav-back'
            onClick={goBack}
            disabled={!canGoBack}
            tooltip='Back'
          />
          <IconButton
            icon='nav-forward'
            onClick={goForward}
            disabled={!canGoForward}
            tooltip='Forward'
          />
          <IconButton
            icon='refresh'
            onClick={refresh}
            tooltip='Refresh'
          />
        </ButtonGroup>

        <Button
          onClick={copyUrlToClipboard}
          tooltip="Click to copy URL"
          style={{
            flex: 1,
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            justifyContent: 'flex-start'
          }}
        >
          {url}
        </Button>

        {loading && (
          <div style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>
            Loading...
          </div>
        )}

        {onClose && (
          <BootstrapButton
            onClick={onClose}
            style={{ marginLeft: '10px' }}
            bsSize='sm'
          >
            Close
          </BootstrapButton>
        )}
      </div>

      {/* WebView */}
      <div style={{ flex: 1 }}>
        <WebviewOverlay
          ref={mWebViewRef as any}
          src={url}
          onLoading={onLoading}
          onNewWindow={onNewWindow}
          events={{
            'did-navigate': onNavigate,
            'did-navigate-in-page': onNavigateInPage,
            'did-finish-load': onFinishLoad,
            'did-start-loading': onStartLoading,
            'did-stop-loading': onStopLoading,
          }}
        />
      </div>
    </div>
  );
};

export default NexusWebView;