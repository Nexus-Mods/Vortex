// oxlint-disable-next-line no-restricted-imports -- the one place zod is imported
import { z } from "zod";

// zod compiles parsers with new Function, which the renderer's CSP forbids
z.config({ jitless: true });

export { z };
