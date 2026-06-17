/**
 * Table Demo Component
 * Demonstrates the reusable Table: sorting, per-column filtering, column
 * show/hide and pagination over a large mock dataset.
 */

import {
  mdiCheckCircle,
  mdiCloudDownload,
  mdiDelete,
  mdiThumbUp,
  mdiThumbUpOutline,
} from "@mdi/js";
import React, { useMemo } from "react";

import { Button } from "../button/Button";
import { Icon } from "../icon/Icon";
import { Typography } from "../typography/Typography";
import { Table } from "./Table";
import type { IColumnDef } from "./Table.types";

interface IDemoMod {
  id: string;
  name: string;
  status: "Enabled" | "Disabled";
  version: string;
  hasUpdate: boolean;
  category: string;
  author: string;
  size: string;
  downloads: number;
  updated: string;
  endorsed: boolean;
}

const CATEGORIES = ["Animation", "Armour", "Audio", "Gameplay", "Patches", "UI", "Weapons"];
const STATUSES: Array<IDemoMod["status"]> = ["Enabled", "Disabled"];
const AUTHORS = ["Arthhh", "Bethesda", "Elianora", "FadingSignal", "PsychoMachina", "SkyUI Team"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

// Deterministically generate a sizeable dataset so the demo exercises sorting,
// filtering and pagination across thousands of rows without any randomness.
const buildMods = (count: number): IDemoMod[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `mod-${index}`,
    name: `Mod name goes here ${index + 1}`,
    status: STATUSES[index % STATUSES.length],
    version: `${(index % 3) + 1}.${index % 5}.${index % 10}`,
    hasUpdate: index % 4 === 0,
    category: CATEGORIES[index % CATEGORIES.length],
    author: AUTHORS[index % AUTHORS.length],
    size: `${((index % 40) + 1) * 5} MB`,
    downloads: (index * 1373) % 100000,
    updated: `${MONTHS[index % MONTHS.length]} 2026`,
    endorsed: index % 3 === 0,
  }));

export const TableDemo = () => {
  const data = useMemo(() => buildMods(60), []);

  const columns = useMemo<Array<IColumnDef<IDemoMod>>>(
    () => [
      {
        id: "status",
        header: "Status",
        getValue: (row) => row.status,
        sortable: true,
        groupable: true,
        width: "140px",
        filter: {
          type: "select",
          options: STATUSES.map((status) => ({ label: status, value: status })),
        },
        cell: (row) => (
          <span className="inline-flex items-center gap-x-1">
            <Icon
              className={row.status === "Enabled" ? "text-success-strong" : "text-neutral-subdued"}
              path={mdiCheckCircle}
              size="sm"
            />

            {row.status}
          </span>
        ),
      },
      {
        id: "name",
        header: "Mod name",
        getValue: (row) => row.name,
        sortable: true,
        width: "240px",
        filter: { type: "text" },
        cell: (row) => <span className="truncate">{row.name}</span>,
      },
      {
        id: "version",
        header: "Version",
        getValue: (row) => row.version,
        sortable: true,
        align: "right",
        width: "120px",
        filter: { type: "text" },
        cell: (row) => (
          <span className="inline-flex items-center justify-end gap-x-1">
            <Typography
              appearance={row.hasUpdate ? "strong" : "moderate"}
              as="span"
              brand={row.hasUpdate ? "primary" : "neutral"}
              typographyType="body-sm"
            >
              {row.version}
            </Typography>

            {row.hasUpdate && (
              <Icon className="text-primary-strong" path={mdiCloudDownload} size="sm" />
            )}
          </span>
        ),
      },
      {
        id: "category",
        header: "Category",
        getValue: (row) => row.category,
        sortable: true,
        groupable: true,
        width: "160px",
        filter: {
          type: "select",
          options: CATEGORIES.map((category) => ({ label: category, value: category })),
        },
      },
      {
        id: "author",
        header: "Author",
        getValue: (row) => row.author,
        sortable: true,
        groupable: true,
        defaultHidden: true,
        width: "160px",
        filter: { type: "text" },
      },
      {
        id: "size",
        header: "Size",
        getValue: (row) => row.size,
        sortable: true,
        defaultHidden: true,
        align: "right",
        width: "110px",
      },
      {
        id: "downloads",
        header: "Downloads",
        getValue: (row) => row.downloads,
        sortable: true,
        defaultHidden: true,
        align: "right",
        width: "130px",
        cell: (row) => row.downloads.toLocaleString(),
      },
      {
        id: "updated",
        header: "Updated",
        getValue: (row) => row.updated,
        sortable: true,
        defaultHidden: true,
        width: "140px",
      },
      {
        id: "endorsed",
        header: "Endorsed",
        getValue: (row) => row.endorsed,
        sortable: true,
        groupable: true,
        groupValue: (row) => (row.endorsed ? "Endorsed" : "Not endorsed"),
        align: "center",
        width: "120px",
        cell: (row) => (
          <Icon
            className={row.endorsed ? "text-success-strong" : "text-neutral-subdued"}
            path={row.endorsed ? mdiThumbUp : mdiThumbUpOutline}
            size="sm"
            title={row.endorsed ? "Endorsed" : "Not endorsed"}
          />
        ),
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        width: "140px",
        hideable: false,
        cell: () => (
          <Button appearance="moderate" brand="neutral" leftIconPath={mdiDelete} size="xs">
            Remove
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Table
        </Typography>

        <Typography appearance="subdued">
          Reusable, column-driven data table. Supports click-to-sort headers, per-column text and
          select filters, grouping by a column, showing/hiding columns via the gear menu, and
          pagination. This demo paginates a 60-row dataset; only the current page is in the DOM.
        </Typography>
      </div>

      <Table
        caption="Mods"
        columns={columns}
        data={data}
        getRowId={(row) => row.id}
        pageSize={15}
      />

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Empty state
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          With no data the table renders a default empty message; pass an `emptyState` node to
          customise it.
        </Typography>

        <Table caption="No mods" columns={columns} data={[]} getRowId={(row) => row.id} />

        <Table
          caption="No mods (custom)"
          columns={columns}
          data={[]}
          emptyState={<Typography appearance="subdued">No mods match your filters yet.</Typography>}
          getRowId={(row) => row.id}
        />
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Design Notes
        </Typography>

        <Typography appearance="subdued" as="ul" className="list-inside list-disc space-y-2">
          <li>Columns are defined declaratively via IColumnDef; cells fall back to getValue</li>

          <li>Sorting, filtering, column visibility and pagination are handled internally</li>

          <li>Set hideable: false to pin a column (e.g. Actions) in the column toggle</li>

          <li>
            Hover a groupable header (Status, Category, Endorsed) and click the group icon to group
            rows; grouping shows collapsible group headers and hides the pager
          </li>

          <li>
            Author, Size, Downloads and Updated are hidden by default (defaultHidden) — enable them
            in the gear menu to push the table past the container and see horizontal scrolling
          </li>

          <li>Pagination bounds the rendered rows; virtualization is tracked separately</li>
        </Typography>
      </div>
    </div>
  );
};
