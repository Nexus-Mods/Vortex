import * as React from 'react';
import { tokens, ColorVariant, SizeVariant, RadiusVariant, TransitionVariant, semanticColorTokens } from '../tokens';
import { clsx, createVariantClasses } from '../utils';

export interface IButtonProps {
  // Core button functionality
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  id?: string;
  name?: string;
  value?: string;
  tabIndex?: number;
  autoFocus?: boolean;

  // Design system props
  variant?: ColorVariant;
  size?: SizeVariant;
  radius?: RadiusVariant;
  transition?: TransitionVariant;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

const getVariantClasses = createVariantClasses(tokens.base.button, tokens.colors);

const Button: React.FC<IButtonProps> = ({
  // Core button props
  onClick,
  onFocus,
  onBlur,
  disabled,
  type = 'button',
  id,
  name,
  value,
  tabIndex,
  autoFocus,

  // Design system props
  variant = 'primary',
  size = 'md',
  radius = 'lg',
  transition = 'base',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  children,
}) => {

  const buttonClasses = clsx(
    // Base component classes
    getVariantClasses(variant),

    // Size and spacing
    tokens.spacing[size],

    // Visual styling
    tokens.radius[radius],
    tokens.transitions[transition],

    // State modifiers
    fullWidth && 'tw:w-full',
    loading && 'tw:pointer-events-none',

    // Custom classes
    className
  );

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      id={id}
      name={name}
      value={value}
      tabIndex={tabIndex}
      autoFocus={autoFocus}
      className={buttonClasses}
      disabled={isDisabled}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {loading && (
        <div className="tw:mr-2 tw:h-4 tw:w-4 tw:border-2 tw:border-white tw:border-t-transparent tw:rounded-full tw:animate-spin" />
      )}

      {leftIcon && !loading && (
        <span className="tw:mr-2 tw:flex-shrink-0">
          {leftIcon}
        </span>
      )}

      <span className={clsx(
        'tw:flex-1',
        (leftIcon || rightIcon || loading) ? 'tw:text-center' : ''
      )}>
        {children}
      </span>

      {rightIcon && !loading && (
        <span className="tw:ml-2 tw:flex-shrink-0">
          {rightIcon}
        </span>
      )}
    </button>
  );
};

export default Button;