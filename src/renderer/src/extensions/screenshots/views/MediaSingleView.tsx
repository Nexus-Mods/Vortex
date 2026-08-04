import React from "react";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";

interface IMediaSingleViewProps {
  active?: boolean;
  api: IExtensionApi;
  content: any;
  entry: any;
  onBack: () => void;
}

export default function MediaSingleView({ onBack }: IMediaSingleViewProps) {
  return (
    <div>
      Single View
      <Button onClick={onBack}>Go Back</Button>
    </div>
  );
}
