// oxlint-disable-next-line no-restricted-imports -- see below
import { z } from "zod";

// zod v4 compiles object-schema parsers with new Function on first parse and
// decides per schema, at construction time, whether that JIT is available.
// The probe backing the decision runs once per process and can sample a
// context where eval is allowed (the preload loads this package before the
// document CSP exists) while parsing later happens in the CSP-bound renderer
// page, where new Function throws EvalError. jitless disables the JIT for
// every schema constructed after this call.
//
// Get z from this module, never from "zod" directly (enforced by the
// no-restricted-imports rule in this package's .oxlintrc.json): the import
// graph then guarantees no schema in this package is constructed before the
// config runs.
z.config({ jitless: true });

export { z };
