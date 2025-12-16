/**
 * Tailwind Component Library - Namespace Export
 *
 * All Tailwind components are exported under the `Tailwind` namespace
 * to avoid naming conflicts with existing Vortex components.
 *
 * Usage:
 *   import { Tailwind } from 'vortex-api';
 *   <Tailwind.Icon path="nxmVortex" size="lg" />
 *   <Tailwind.Button buttonType="primary">Click</Tailwind.Button>
 */

// Import all components and utilities
import * as typography from "./components/next/typography";
import * as button from "./components/next/button";
import * as icon from "./components/next/icon";
import * as link from "./components/next/link";
import * as collectiontile from "./components/next/collectiontile";
import * as form from "./components/next/form";
import * as tabs from "./components/next/tabs";
import * as iconPaths from "./lib/icon-paths";

/**
 * Tailwind namespace containing all Tailwind components and utilities
 *
 * Components:
 * - Typography: Typography component with design system styles
 * - Button: Button component with multiple types and states
 * - Icon: Icon component supporting MDI and Nexus custom icons
 * - Link: Link wrapper component for Electron
 * - CollectionTile: Collection card component
 * - FormField: Form field wrapper with labels, hints, and validation
 * - Input: Input component with validation and accessibility features
 * - Select: Select dropdown with custom styling and icon
 * - Tabs: Complete tabbed interface system with keyboard navigation
 *
 * Icon Paths:
 * - nxm*: 34 custom Nexus Mods icons (nxmVortex, nxmCollection, etc.)
 *
 * Types:
 * - ButtonType, IconSize, IconProps, FormFieldProps, InputProps, SelectProps, TabsState, etc.
 */
export const Tailwind = {
  // Typography components and types
  ...typography,

  // Button components and types
  ...button,

  // Icon component and types
  ...icon,

  // Link component
  ...link,

  // Collection tile component
  ...collectiontile,

  // Form components (FormField, Input, Select)
  ...form,

  // Tabs components (TabProvider, TabBar, TabButton, TabLink, TabPanel)
  ...tabs,

  // Icon paths (nxm* icons)
  ...iconPaths,
};

// Also export as default for convenience
export default Tailwind;

// Type exports for external consumers
export type {
  // Typography types
  TypographyProps,
  TypographyTypes,
} from "./components/next/typography/Typography";

export type {
  // Button types
  ButtonType,
} from "./components/next/button/Button";

export type {
  // Icon types
  IconProps,
  IconSize,
} from "./components/next/icon/Icon";

export type {
  // CollectionTile types
  CollectionTileProps,
} from "./components/next/collectiontile/CollectionTile";

export type {
  // Form types
  FormFieldProps,
  BaseFormFieldProps,
  InputProps,
  SelectProps,
} from "./components/next/form";

export type {
  // Tabs types
  TabsState,
  TabProviderProps,
  TabButtonProps,
  TabLinkProps,
} from "./components/next/tabs";
