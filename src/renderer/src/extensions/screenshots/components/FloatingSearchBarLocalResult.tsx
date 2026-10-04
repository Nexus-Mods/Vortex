import React from "react";

import type { IMod } from "@/extensions/mod_management/types/IMod";

interface IFloatingSearchBarLocalResultProps {
  mod: IMod;
  onClick: () => void;
}

export default function FloatingSearchBarLocalResult({
  mod,
  onClick,
}: IFloatingSearchBarLocalResultProps) {
  return (
    <div className="cursor-pointer" onClick={onClick}>
      {mod.attributes?.logicalFileName}
    </div>
  );
}
