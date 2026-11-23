import type { ReactNode } from "react";

import type { IExternalImagePlaceholderOptions } from "@/ui/components/prose/external_image_placeholder/ExternalImagePlaceholder";

/** A tag as the parser builds its tree, which its typings leave out. */
export interface IParsedTag {
  name: string | null;
  text: string;
  params: Record<string, string | undefined>;
  parent: IParsedTag | null;
  children: IParsedTag[];
  renderer: {
    strip: (text: string) => string;
    options: { externalImagePlaceholders?: IExternalImagePlaceholderOptions };
  };
  getContent: (raw?: boolean) => string;
  toReact: () => ReactNode;
}
