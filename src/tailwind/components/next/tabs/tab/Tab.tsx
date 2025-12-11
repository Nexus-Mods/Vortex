"use client";

import * as React from "react";
import {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  useEffect,
  useRef,
} from "react";
import numeral = require("numeral");

import { Typography } from "../../typography";
import { getTabId, joinClasses } from "../../utils";

import { useTabContext } from "../tabs.context";

type Tab = {
  count?: number;
  name: string;
};

export type TabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Tab;
export type TabLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & Tab;

export const TabContent = ({
  count,
  label,
}: {
  count?: number;
  label: string;
}) => (
  <span className="tw:flex tw:items-center tw:gap-x-1 tw:pb-2">
    <Typography
      appearance="none"
      as="span"
      className="tw:whitespace-nowrap tw:transition-colors"
      typographyType="body-xl"
    >
      {label}
    </Typography>

    {count !== undefined && (
      <Typography
        appearance="none"
        as="span"
        className="tw:bg-surface-mid tw:text-neutral-subdued tw:flex tw:items-center tw:justify-center tw:rounded-full tw:px-2 tw:py-0.5 tw:transition-colors"
        typographyType="body-sm"
      >
        {numeral(count).format("0,0")}
      </Typography>
    )}
  </span>
);

/**
 * Standard tab component, implemented as a button. Clicking it will reveal the
 * content for the selected tab.
 */
export const TabButton = ({
  className,
  count,
  disabled,
  name,
  ...props
}: TabButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null!);
  const { onKeyDown, onTabClick, registerTab, selectedTab, tabListId } =
    useTabContext();

  const tabId = getTabId(name);
  const selected = selectedTab === getTabId(name);

  // Register the tab ref with the parent tab bar to set focus on keydown
  useEffect(
    () => registerTab({ name: tabId, ref, type: "button" }),
    [tabId, registerTab],
  );

  return (
    <button
      ref={ref}
      aria-controls={`tabcontent-${tabId}`}
      aria-selected={selected}
      className={joinClasses([
        "tw:relative tw:border-b focus-visible:tw:-outline-offset-2 tw:transition-colors",
        selected
          ? "tw:border-primary-moderate tw:text-neutral-strong"
          : "tw:border-transparent tw:text-neutral-subdued",
        disabled
          ? "tw:cursor-not-allowed tw:opacity-40"
          : "tw:cursor-pointer tw:hover:text-neutral-moderate",
        className,
      ])}
      disabled={disabled}
      id={`tablist-${tabListId}-${tabId}`}
      role="tab"
      tabIndex={selected ? 0 : -1}
      type="button"
      onClick={() => onTabClick(tabId)}
      onKeyDown={onKeyDown}
      {...props}
    >
      <TabContent count={count} label={name} />
    </button>
  );
};

/**
 * Link tab component. This is not selectable, but can be clicked to open
 * the link. Can also be focused using arrow key navigation (but not selected).
 */
export const TabLink = ({ className, count, name, ...props }: TabLinkProps) => {
  const ref = useRef<HTMLAnchorElement>(null!);
  const { onKeyDown, registerTab, tabListId } = useTabContext();

  const tabId = getTabId(name);

  // Register the tab ref with the parent tab bar to set focus on keydown
  useEffect(
    () => registerTab({ name: tabId, ref, type: "link" }),
    [tabId, registerTab],
  );

  return (
    <a
      ref={ref}
      className={joinClasses([
        "tw:border-b tw:border-transparent tw:text-neutral-subdued focus-visible:tw:-outline-offset-2 tw:hover:text-neutral-moderate tw:transition-colors",
        className,
      ])}
      id={`tablist-${tabListId}-${tabId}`}
      role="tab"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      {...props}
    >
      <TabContent count={count} label={name} />
    </a>
  );
};
