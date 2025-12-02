/**
 * MainWindowWrapper - Feature flag switcher for main window layouts
 * 
 * Conditionally renders either the legacy MainWindow or the new
 * MainWindowNext based on the --feature-ui CLI flag.
 */

import * as React from 'react';
import { useSelector } from 'react-redux';
import { IState } from '../types/IState';
import { IExtensionApi } from '../types/IExtensionContext';
import { TFunction } from '../util/i18n';
import { IMainPage } from '../types/IMainPage';
import { extend } from '../util/ComponentEx';
import { IRegisteredExtension } from '../util/ExtensionManager';
import { IMainPageOptions } from '../types/IExtensionContext';

// Lazy load both components for code splitting
const MainWindowLegacy = React.lazy(() => import('./MainWindow'));
const MainWindowNext = React.lazy(() => import('./MainWindowNext'));

export interface IMainWindowWrapperBaseProps {
  t: TFunction;
  className: string;
  api: IExtensionApi;
}

export interface IMainWindowWrapperExtendedProps {
  objects: IMainPage[];
}

export type IMainWindowWrapperProps = IMainWindowWrapperBaseProps & IMainWindowWrapperExtendedProps;

/**
 * Wrapper component that conditionally renders either the legacy MainWindow
 * or the new Tailwind-based MainWindowNext based on the --feature-ui CLI flag.
 */
function MainWindowWrapper(props: IMainWindowWrapperProps) {
  const { t, className, api, objects } = props;
  
  const featureUi = useSelector(
    (state: IState) => (state.session?.base?.commandLine as any)?.featureUi ?? false
  );

  // Loading fallback with minimal styling
  const fallback = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#18181b',
      color: '#a1a1aa',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>
          Loading Vortex...
        </div>
        <div style={{ 
          width: '200px', 
          height: '4px', 
          backgroundColor: '#27272a',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: '40%',
            height: '100%',
            backgroundColor: '#f97316',
            borderRadius: '2px',
            animation: 'loading 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );

  return (
    <React.Suspense fallback={fallback}>
      {featureUi ? (
        <MainWindowNext 
          t={t} 
          className={className} 
          api={api} 
          objects={objects} 
        />
      ) : (
        <MainWindowLegacy 
          t={t} 
          className={className} 
          api={api} 
        />
      )}
    </React.Suspense>
  );
}

// Helper functions for extend() HOC
const emptyFunc = () => undefined;
const trueFunc = () => true;

function registerMainPage(
  instanceGroup: undefined,
  extInfo: Partial<IRegisteredExtension>,
  icon: string,
  title: string,
  component: React.ComponentClass<any> | React.StatelessComponent<any>,
  options: IMainPageOptions): IMainPage {
  return {
    id: options.id || title,
    icon,
    title,
    component,
    propsFunc: options.props || emptyFunc,
    visible: options.visible || trueFunc,
    group: options.group,
    badge: options.badge,
    activity: options.activity,
    priority: options.priority !== undefined ? options.priority : 100,
    onReset: options.onReset,
    namespace: extInfo.namespace,
  };
}

// Apply the same extend() HOC as MainWindow to receive registered pages
export default extend(registerMainPage, undefined, true)(
  MainWindowWrapper
) as React.ComponentClass<IMainWindowWrapperBaseProps>;
