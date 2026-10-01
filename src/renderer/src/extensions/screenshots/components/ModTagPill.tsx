import { mdiClose } from "@mdi/js";
import React from "react";

import { Button } from "@/ui/components/button/Button";
import { Pill } from "@/ui/components/pill/Pill";
import { Typography } from "@/ui/components/typography/Typography";

import type { GameMediaModTag } from "../util/mediaTypes";

interface IModTagsIndicatorProps {
  tag: GameMediaModTag;
  onRemove: () => void;
}

export default function ModTagPill({ tag, onRemove }: IModTagsIndicatorProps) {
  return (
    <Pill appearance="subdued" as="button" brand="neutral" iconPath={mdiClose}>
      {tag.name}
    </Pill>
  );
}
