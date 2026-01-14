"use client";

import * as React from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { useEffect, useRef } from "react";
import numeral from "numeral";

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
  <span className="flex items-center gap-x-1 pb-2">
    <Typography
      appearance="none"
      as="span"
      className="whitespace-nowrap transition-colors"
      typographyType="body-xl"
    >
      {label}
    </Typography>

    {count !== undefined && (
      <Typography
        appearance="none"
        as="span"
        className="bg-surface-mid text-neutral-subdued flex items-center justify-center rounded-full px-2 py-0.5 transition-colors"
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
        "relative border-b focus-visible:-outline-offset-2 transition-colors",
        selected
          ? "border-primary-moderate text-neutral-strong"
          : "border-transparent text-neutral-subdued",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:text-neutral-moderate",
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
        "border-b border-transparent text-neutral-subdued focus-visible:-outline-offset-2 hover:text-neutral-moderate transition-colors",
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
