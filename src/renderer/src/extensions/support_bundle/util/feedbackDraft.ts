import type { LogWindowMinutes } from "@vortex/shared";

/** What the user had written and chosen in the feedback dialog. */
export interface IFeedbackDraft {
  text: string;
  showAdvanced: boolean;
  includeSupportData: boolean;
  logWindowMinutes: LogWindowMinutes;
}

let saved: IFeedbackDraft | undefined;

/**
 * Keeps a draft for the next time the dialog opens. Logging in again takes the dialog's place, as
 * only one dialog shows at a time, and the dialog starts empty whenever it opens.
 */
export function saveFeedbackDraft(draft: IFeedbackDraft): void {
  saved = draft.text.trim() === "" ? undefined : draft;
}

/** Forgets the draft, when the dialog it was kept for won't come back. */
export function clearFeedbackDraft(): void {
  saved = undefined;
}

/** The draft kept, once: it is gone after this. */
export function takeFeedbackDraft(): IFeedbackDraft | undefined {
  const draft = saved;
  saved = undefined;
  return draft;
}
