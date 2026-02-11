"use client";

import type { ClassAttributes } from "react";

import { mdiMenuLeft, mdiMenuRight } from "@mdi/js";
import { useMemo } from "react";

import { Icon } from "../next/icon";
import { joinClasses } from "../next/utils";
import { JumpToPage } from "./JumpToPage";

export interface PaginationProps extends ClassAttributes<HTMLElement> {
  className?: string;
  currentPage: number;
  /**
   * A callback function to handle calls outside the component
   * @param page
   * @param recordsPerPage
   */
  onPaginationUpdate?: (page: number, recordsPerPage: number) => void;
  recordsPerPage: number;
  /**
   * Change scroll position page when page is changed
   */
  scrollTo?: "top" | [number, number];
  totalRecords?: number;
}

export const Pagination = ({
  className,
  currentPage,
  onPaginationUpdate = () => undefined,
  recordsPerPage,
  scrollTo,
  totalRecords = 0,
  ...props
}: PaginationProps) => {
  const totalPages = useMemo(
    () => Math.ceil(totalRecords / recordsPerPage),
    [totalRecords, recordsPerPage],
  );

  const activePages: Array<number | "..."> = useMemo(() => {
    if (totalPages < 1) {
      return [];
    }

    if (totalPages <= 5) {
      return Array.from(Array(totalPages)).map((_, i) => i + 1);
    }

    const pages: Array<number | "..."> = [1];

    if (currentPage <= 3) {
      pages.push(2, 3, 4, "...");
    } else if (currentPage >= totalPages - 2) {
      pages.push("...", totalPages - 3, totalPages - 2, totalPages - 1);
    } else {
      pages.push("...", currentPage - 1, currentPage, currentPage + 1, "...");
    }

    pages.push(totalPages);

    return pages;
  }, [totalPages, currentPage]);

  if (totalPages < 2) {
    return null;
  }

  const handlePageChange = (page: number) => {
    if (page !== currentPage) {
      if (scrollTo === "top") {
        window.scrollTo(0, 0);
      } else if (Array.isArray(scrollTo)) {
        window.scrollTo(...scrollTo);
      }

      onPaginationUpdate(page, recordsPerPage);
    }
  };

  const commonClasses =
    "flex min-h-8 min-w-6 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const arrowClasses =
    "text-neutral-moderate enabled:hover:text-neutral-strong";

  return (
    <nav
      aria-label="Pagination navigation"
      className={joinClasses([
        "flex flex-col items-start gap-6 sm:flex-row sm:items-center",
        className,
      ])}
      role="navigation"
      {...props}
    >
      <div className="flex items-center gap-x-2">
        <button
          aria-label="Go to previous page"
          className={joinClasses([arrowClasses, commonClasses])}
          disabled={totalPages < 1 || currentPage === 1}
          title="Previous page"
          type="button"
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
        >
          <Icon path={mdiMenuLeft} size="lg" title="Previous page" />
        </button>

        {activePages.map((page, i) =>
          page === "..." ? (
            <span
              className={joinClasses([
                "typography-body-md font-semibold text-neutral-subdued",
                commonClasses,
              ])}
              key={`dots-${i}`}
            >
              {page}
            </span>
          ) : (
            <button
              aria-current={currentPage === page ? "true" : "false"}
              aria-label={`Go to page ${page}`}
              className={joinClasses([
                commonClasses,
                "px-1 enabled:hover:text-neutral-moderate",
                currentPage === page
                  ? "relative text-neutral-strong after:absolute after:inset-x-0 after:bottom-0 after:border-b after:border-b-stroke-strong"
                  : "text-neutral-subdued",
              ])}
              key={page}
              type="button"
              onClick={() => {
                handlePageChange(page);
              }}
            >
              {page}
            </button>
          ),
        )}

        <button
          aria-label="Go to next page"
          className={joinClasses([arrowClasses, commonClasses])}
          disabled={totalPages < 1 || currentPage === totalPages}
          title="Next page"
          type="button"
          onClick={() => {
            handlePageChange(Math.min(totalPages, currentPage + 1));
          }}
        >
          <Icon path={mdiMenuRight} size="lg" title="Next page" />
        </button>
      </div>

      {totalPages >= 7 && (
        <JumpToPage
          currentPage={currentPage}
          recordsPerPage={recordsPerPage}
          totalRecords={totalRecords}
          onPaginationUpdate={onPaginationUpdate}
        />
      )}
    </nav>
  );
};
