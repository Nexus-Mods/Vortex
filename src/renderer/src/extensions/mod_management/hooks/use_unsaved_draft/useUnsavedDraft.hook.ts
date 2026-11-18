import { useCallback, useEffect, useRef, useState } from "react";

/** A field's draft, what changes it, and what saves it. */
export interface IUnsavedDraft {
  draft: string;
  /** Takes what's typed as the draft, unsaved. */
  change: (text: string) => void;
  /** Saves the draft, if anything's been typed since it was last saved. */
  save: () => void;
}

/**
 * A text field's draft, starting as its value: saved when `save` is called, as on leaving the
 * field, and on the way out with typing unsaved, as when the field is made again for other mods.
 * It saves with the `onSave` it was last drawn with, so to what it was typed for.
 */
export const useUnsavedDraft = (value: string, onSave: (text: string) => void): IUnsavedDraft => {
  const [draft, setDraft] = useState(value);
  // What's typed and not yet saved, if anything.
  const unsaved = useRef<string | undefined>(undefined);
  const latest = useRef(onSave);

  useEffect(() => {
    latest.current = onSave;
  });

  const save = useCallback(() => {
    const text = unsaved.current;
    if (text !== undefined) {
      unsaved.current = undefined;
      latest.current(text);
    }
  }, []);

  useEffect(() => save, [save]);

  const change = useCallback((text: string) => {
    unsaved.current = text;
    setDraft(text);
  }, []);

  return { draft, change, save };
};
