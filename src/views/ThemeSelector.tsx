import * as React from 'react';
import { TFunction } from '../util/i18n';

export interface IThemeSelectorProps {
  t: TFunction;
}

type ThemeMode = 'system' | 'light' | 'dark';

interface IThemeSelectorState {
  currentTheme: ThemeMode;
  isOpen: boolean;
}

class ThemeSelector extends React.Component<IThemeSelectorProps, IThemeSelectorState> {
  private dropdownRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: IThemeSelectorProps) {
    super(props);
    this.state = {
      currentTheme: this.getStoredTheme(),
      isOpen: false,
    };
  }

  public componentDidMount() {
    this.applyTheme(this.state.currentTheme);
    document.addEventListener('click', this.handleOutsideClick);
  }

  public componentWillUnmount() {
    document.removeEventListener('click', this.handleOutsideClick);
  }

  private getStoredTheme(): ThemeMode {
    try {
      const stored = localStorage.getItem('vortex-theme-preference');
      if (stored && ['system', 'light', 'dark'].includes(stored)) {
        return stored as ThemeMode;
      }
    } catch (err) {
      // Fallback if localStorage unavailable
    }
    return 'system';
  }

  private setStoredTheme(theme: ThemeMode) {
    try {
      localStorage.setItem('vortex-theme-preference', theme);
    } catch (err) {
      // Ignore storage errors
    }
  }

  private applyTheme = (theme: ThemeMode) => {
    const html = document.documentElement;

    if (theme === 'dark') {
      html.classList.add('dark');
    } else if (theme === 'light') {
      html.classList.remove('dark');
    } else {
      // System theme - use CSS media query
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }

    // Try to sync with Electron if available
    this.syncWithElectron(theme);
  };

  private syncWithElectron = (theme: ThemeMode) => {
    try {
      // Check if we have access to Electron's nativeTheme
      const { nativeTheme } = (window as any).require?.('electron') || {};
      if (nativeTheme) {
        nativeTheme.themeSource = theme;
      }
    } catch (err) {
      // Electron API not available, continue with CSS-only approach
    }
  };

  private handleThemeChange = (theme: ThemeMode) => {
    this.setState({ currentTheme: theme, isOpen: false });
    this.setStoredTheme(theme);
    this.applyTheme(theme);
  };

  private toggleDropdown = () => {
    this.setState(prev => ({ isOpen: !prev.isOpen }));
  };

  private handleOutsideClick = (event: MouseEvent) => {
    if (this.dropdownRef.current && !this.dropdownRef.current.contains(event.target as Node)) {
      this.setState({ isOpen: false });
    }
  };

  private getThemeIcon = (theme: ThemeMode): string => {
    switch (theme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'system':
      default:
        return '🖥️';
    }
  };

  private getThemeLabel = (theme: ThemeMode): string => {
    const { t } = this.props;
    switch (theme) {
      case 'light':
        return t('Light');
      case 'dark':
        return t('Dark');
      case 'system':
      default:
        return t('System');
    }
  };

  public render(): JSX.Element {
    const { currentTheme, isOpen } = this.state;
    const themes: ThemeMode[] = ['system', 'light', 'dark'];

    return (
      <div className="tw:relative tw:w-full" ref={this.dropdownRef}>
        <button
          onClick={this.toggleDropdown}
          className="tw:w-full tw:aspect-square tw:p-2 tw:rounded tw:bg-gray-200 tw:dark:bg-gray-700 tw:text-gray-900 tw:dark:text-white tw:text-xl tw:flex tw:items-center tw:justify-center tw:transition-colors tw:relative"
          title={`Theme: ${this.getThemeLabel(currentTheme)}`}
        >
          <span>{this.getThemeIcon(currentTheme)}</span>
          <span className={`tw:absolute tw:bottom-0 tw:right-0 tw:text-xs tw:transition-transform tw:duration-200 ${isOpen ? 'tw:rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {isOpen && (
          <div className="tw:absolute tw:top-full tw:left-0 tw:right-0 tw:mt-1 tw:bg-white tw:dark:bg-gray-800 tw:rounded tw:shadow-lg tw:border tw:border-gray-300 tw:dark:border-gray-600 tw:z-50">
            {themes.map((theme) => (
              <button
                key={theme}
                onClick={() => this.handleThemeChange(theme)}
                className={`tw:w-full tw:p-2 tw:text-left tw:flex tw:items-center tw:gap-2 tw:text-sm tw:transition-colors hover:tw:bg-gray-100 tw:dark:hover:bg-gray-700 ${
                  currentTheme === theme
                    ? 'tw:bg-blue-50 tw:dark:bg-blue-900/20 tw:text-blue-600 tw:dark:text-blue-400'
                    : 'tw:text-gray-900 tw:dark:text-white'
                }`}
              >
                <span>{this.getThemeIcon(theme)}</span>
                <span>{this.getThemeLabel(theme)}</span>
                {currentTheme === theme && (
                  <span className="tw:ml-auto tw:text-blue-600 tw:dark:text-blue-400">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
}

export default ThemeSelector;