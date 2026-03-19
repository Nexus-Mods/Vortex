import { mdiMenuLeft, mdiMenuRight } from "@mdi/js";
import { useMemo, type ClassAttributes, type RefObject } from "react";

import { joinClasses } from "../../utils/joinClasses";
import { Icon } from "../icon/Icon";
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
   * Ref to an element to scroll into view when page changes
   */
  scrollRef?: RefObject<HTMLElement>;
  totalRecords?: number;
}

export const Pagination = ({
  className,
  currentPage,
  onPaginationUpdate = () => undefined,
  recordsPerPage,
  scrollRef,
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
      if (scrollRef?.current) {
        scrollRef.current.scrollTo({ top: 0 });
      }

      onPaginationUpdate(page, recordsPerPage);
    }
  };

  return (
    <nav
      aria-label="Pagination navigation"
      className={joinClasses(["nxm-pagination", className])}
      role="navigation"
      {...props}
    >
      <div className="nxm-pagination-items">
        <button
          aria-label="Go to previous page"
          className="nxm-pagination-arrow"
          disabled={totalPages < 1 || currentPage === 1}
          title="Previous page"
          type="button"
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
        >
          <Icon path={mdiMenuLeft} size="none" />
        </button>

        {activePages.map((page, i) =>
          page === "..." ? (
            <span className="nxm-pagination-separator" key={`dots-${i}`}>
              {page}
            </span>
          ) : (
            <button
              aria-current={currentPage === page ? "true" : "false"}
              aria-label={`Go to page ${page}`}
              className={joinClasses("nxm-pagination-number", {
                "nxm-pagination-number-active": currentPage === page,
              })}
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
          className="nxm-pagination-arrow"
          disabled={totalPages < 1 || currentPage === totalPages}
          title="Next page"
          type="button"
          onClick={() => {
            handlePageChange(Math.min(totalPages, currentPage + 1));
          }}
        >
          <Icon path={mdiMenuRight} size="none" />
        </button>
      </div>

      {totalPages >= 7 && (
        <JumpToPage
          currentPage={currentPage}
          recordsPerPage={recordsPerPage}
          totalPages={totalPages}
          onPaginationUpdate={handlePageChange}
        />
      )}
    </nav>
  );
};
