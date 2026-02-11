"use client";

import { useMemo } from "react";
// import { useForm } from 'react-hook-form';

import type { PaginationProps } from "./Pagination";

import { Button } from "../next/button";
import { Input } from "../next/form";
import { Typography } from "../next/typography";

export const JumpToPage = ({
  currentPage,
  onPaginationUpdate = () => undefined,
  recordsPerPage,
  totalRecords = 0,
}: Pick<
  PaginationProps,
  "currentPage" | "onPaginationUpdate" | "recordsPerPage" | "totalRecords"
>) => {
  const totalPages = useMemo(
    () => Math.ceil(totalRecords / recordsPerPage),
    [totalRecords, recordsPerPage],
  );

  // const {
  //   formState: { errors, isValid },
  //   handleSubmit,
  //   register,
  //   reset,
  // } = useForm<{ page: number }>({
  //   mode: 'onChange',
  //   values: {
  //     page: currentPage,
  //   },
  // });

  const handlePageChange = ({ page }: { page: number }) => {
    // if (isValid) {
    //   window.scrollTo(0, 0);
    //   onPaginationUpdate(+page, recordsPerPage);
    //   reset();
    // }
  };

  return (
    <form
      className="flex items-center gap-2"
      // onSubmit={handleSubmit(handlePageChange)}
    >
      <Typography>Page</Typography>

      <Input
        aria-label="Jump to page"
        className="w-20!"
        // errorMessage={errors.page?.message}
        fieldClassName="w-auto!"
        hideLabel={true}
        max={totalPages}
        min={1}
        pattern="[0-9]*"
        type="number"
        //{...register('page', {
        //  max: totalPages,
        //  min: 1,
        //  pattern: /^[0-9]*$/,
        //  required: true,
        //})}
      />

      <Button
        // aria-disabled={!isValid}
        as="button"
        buttonType="secondary"
        className="min-w-6"
        filled="weak"
        type="submit"
      >
        Go
      </Button>
    </form>
  );
};
