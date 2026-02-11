"use client";

import React, { useState, type FormEvent } from "react";

import type { PaginationProps } from "./Pagination";

import { Button } from "../next/button";
import { Input } from "../next/form";

export const JumpToPage = ({
  currentPage,
  onPaginationUpdate,
  recordsPerPage,
  totalPages,
}: Pick<
  PaginationProps,
  "currentPage" | "onPaginationUpdate" | "recordsPerPage"
> & { totalPages: number }) => {
  const [page, setPage] = useState(currentPage);
  const [prevCurrentPage, setPrevCurrentPage] = useState(currentPage);

  if (currentPage !== prevCurrentPage) {
    setPrevCurrentPage(currentPage);
    setPage(currentPage);
  }

  const isValid = Number.isInteger(page) && page >= 1 && page <= totalPages;

  const handleSubmit = (event: FormEvent) => {
    if (isValid) {
      onPaginationUpdate(page, recordsPerPage);
    }

    event.preventDefault();
  };

  return (
    <form className="nxm-pagination-page" onSubmit={handleSubmit}>
      <div className="nxm-pagination-page-label">Page</div>

      <Input
        aria-label="Jump to page"
        className="nxm-pagination-page-input"
        errorMessage={
          !isValid ? `Enter a page between 1 and ${totalPages}` : undefined
        }
        fieldClassName="w-auto!"
        hideLabel={true}
        max={totalPages}
        min={1}
        pattern="[0-9]*"
        size="sm"
        type="number"
        value={page}
        onChange={(e) => setPage(e.target.valueAsNumber)}
      />

      <Button
        aria-disabled={!isValid}
        as="button"
        buttonType="secondary"
        filled="weak"
        size="sm"
        type="submit"
      >
        Go
      </Button>
    </form>
  );
};
