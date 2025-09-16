import * as React from 'react';
import { clsx } from '../utils';
import { tokens } from '../tokens';

export interface ISidebarButtonProps {
  // Core button functionality
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  id?: string;
  name?: string;
  tabIndex?: number;
  autoFocus?: boolean;

  // Component-specific props
  icon?: React.ReactNode;
  label: string;
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
  badge?: React.ReactNode;
  activity?: React.ReactNode;
  selected?: boolean;
}

const SidebarButton: React.FC<ISidebarButtonProps> = ({
  // Core button props
  onClick,
  onFocus,
  onBlur,
  disabled = false,
  type = 'button',
  id,
  name,
  tabIndex,
  autoFocus,

  // Component props
  icon,
  label,
  variant = 'default',
  className = '',
  badge,
  activity,
  selected = false,
}) => {
  const baseClasses = 'tw:w-full tw:h-10 tw:px-3 tw:py-2 tw:rounded-lg tw:inline-flex tw:justify-start tw:items-center tw:gap-3 tw:transition-colors';

  const variantClasses = {
    default: selected
      ? 'tw:bg-blue-100 tw:dark:bg-blue-900 tw:text-blue-900 tw:dark:text-blue-100 tw:hover:bg-blue-200 tw:dark:hover:bg-blue-800'
      : 'tw:bg-gray-100 tw:dark:bg-gray-800 tw:text-gray-900 tw:dark:text-white tw:hover:bg-gray-200 tw:dark:hover:bg-gray-700',
    primary: 'tw:bg-blue-600 tw:text-white tw:hover:bg-blue-700',
    secondary: selected
      ? 'tw:bg-blue-100 tw:dark:bg-blue-900 tw:text-blue-900 tw:dark:text-blue-100 tw:hover:bg-blue-200 tw:dark:hover:bg-blue-800'
      : 'tw:bg-gray-200 tw:text-gray-900 tw:hover:bg-gray-300 tw:dark:bg-gray-700 tw:dark:text-white tw:dark:hover:bg-gray-600'
  };

  const disabledClasses = disabled ? 'tw:opacity-50 tw:cursor-not-allowed tw:pointer-events-none' : 'tw:cursor-pointer';

  const buttonClasses = clsx(
    baseClasses,
    variantClasses[variant],
    disabledClasses,
    className
  );

  return (
    <button
      type={type}
      id={id}
      name={name}
      tabIndex={tabIndex}
      autoFocus={autoFocus}
      className={buttonClasses}
      disabled={disabled}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Icon container */}
      <div className="tw:w-5 tw:h-5 tw:relative tw:flex-shrink-0 tw:flex tw:items-center tw:justify-center">
        {icon}
      </div>

      {/* Label */}
      <div className={`tw:flex-1 tw:flex tw:justify-start tw:items-center ${tokens.textStyles.body.lg.semibold}`}>
        {label}
      </div>

      {/* Badge */}
      {badge && (
        <div className="tw:flex-shrink-0">
          {badge}
        </div>
      )}

      {/* Activity */}
      {activity && (
        <div className="tw:flex-shrink-0">
          {activity}
        </div>
      )}
    </button>
  );
};

export default SidebarButton;