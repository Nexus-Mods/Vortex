/**
 * Table Demo Component
 * The new table as it stands; it grows a step at a time towards the design.
 */

import React from "react";

import { Switch } from "@/ui/components/form/switch/Switch";
import { Typography } from "@/ui/components/typography/Typography";

import { Table } from "./Table";
import type { ITableColumn } from "./Table.types";

interface IDemoMod {
  id: string;
  name: string;
  enabled: boolean;
}

const MODS: IDemoMod[] = [
  { id: "1", name: "Realistic Water Two", enabled: true },
  { id: "2", name: "Enhanced Blood Textures", enabled: false },
  { id: "3", name: "Frostfall - Hypothermia Camping Survival", enabled: true },
  { id: "4", name: "Immersive Whiterun Overhaul", enabled: true },
  { id: "5", name: "JK's Solitude - City Redesign", enabled: false },
];

const COLUMNS: Array<ITableColumn<IDemoMod>> = [
  { id: "name", header: "Name", cell: (mod) => <span className="truncate">{mod.name}</span> },
  {
    id: "status",
    header: "Status",
    width: "42px",
    cell: (mod) => <Switch aria-label={`${mod.name} enabled`} checked={mod.enabled} />,
  },
];

export const TableDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Table
      </Typography>

      <Typography appearance="subdued">
        A column-driven table drawn as one CSS grid, each row a subgrid of its columns. Work in
        progress towards the new table design, behind the dev tools "New table design" switch.
      </Typography>
    </div>

    <Table columns={COLUMNS} getRowId={(mod) => mod.id} label="Mods" rows={MODS} />
  </div>
);
