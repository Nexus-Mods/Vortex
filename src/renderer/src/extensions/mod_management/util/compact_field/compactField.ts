/**
 * The design's compact fields: a 240px control, narrower than the panel, with 12px hints at its
 * full width, 8px under the control. The field components draw hints larger and controls full
 * width elsewhere, so the panel's own say so here, in one place.
 */
export const COMPACT_FIELD =
  "[&_.nxm-field-control]:w-60 [&_.nxm-field-description]:text-body-sm [&_.nxm-field-footer]:mt-2";
