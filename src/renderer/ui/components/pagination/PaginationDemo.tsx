/**
 * Pagination Demo Component
 * Demonstrates the Pagination component variants and features
 */

import React, { useState } from "react";

import { Typography } from "../typography";
import { Pagination } from "./Pagination";

export const PaginationDemo = () => {
  const [fewPage, setFewPage] = useState(1);
  const [manyPage, setManyPage] = useState(1);
  const [jumpPage, setJumpPage] = useState(4);

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Pagination
        </Typography>

        <Typography appearance="subdued">
          Page navigation for paginated lists. Automatically adapts its layout
          based on total page count — showing all pages when few, collapsing
          with ellipsis when many, and adding a "Jump to Page" input for large
          sets.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Few Pages
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          When there are 5 or fewer pages, all page numbers are shown without
          ellipsis.
        </Typography>

        <Pagination
          currentPage={fewPage}
          recordsPerPage={10}
          totalRecords={40}
          onPaginationUpdate={(page) => setFewPage(page)}
        />
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Many Pages with Ellipsis
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          When there are more than 5 pages, the component collapses middle pages
          into ellipsis and always shows the first and last page.
        </Typography>

        <Pagination
          currentPage={manyPage}
          recordsPerPage={10}
          totalRecords={120}
          onPaginationUpdate={(page) => setManyPage(page)}
        />
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Jump to Page
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          When there are 7 or more pages, a "Jump to Page" input appears
          allowing direct navigation to any page.
        </Typography>

        <Pagination
          currentPage={jumpPage}
          recordsPerPage={10}
          totalRecords={200}
          onPaginationUpdate={(page) => setJumpPage(page)}
        />
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Design Notes
        </Typography>

        <Typography
          appearance="subdued"
          as="ul"
          className="list-inside list-disc space-y-2"
        >
          <li>
            Returns null when there are fewer than 2 pages — no need to
            conditionally render
          </li>

          <li>
            Previous and next arrows are disabled at the first and last pages
          </li>

          <li>
            The onPaginationUpdate callback receives both the page number and
            recordsPerPage
          </li>

          <li>
            An optional scrollRef prop scrolls a container to the top on page
            change
          </li>
        </Typography>
      </div>
    </div>
  );
};
