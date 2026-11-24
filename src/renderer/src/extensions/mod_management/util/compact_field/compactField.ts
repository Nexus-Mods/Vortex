/**
 * The design's compact hints: 12px at the field's full width, 8px under the control. The field
 * components draw hints larger elsewhere, so the panel's own say so here, in one place.
 */
export const COMPACT_HINTS = "[&_.nxm-field-description]:text-body-sm [&_.nxm-field-footer]:mt-2";

/**
 * The design's compact fields: a 240px control, narrower than the panel, with compact hints. The
 * field components draw controls full width elsewhere.
 */
export const COMPACT_FIELD = `[&_.nxm-field-control]:w-60 ${COMPACT_HINTS}`;
