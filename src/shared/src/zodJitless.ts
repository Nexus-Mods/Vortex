import { z } from "zod";

// zod v4 JIT-compiles object schemas with new Function on first parse. The
// renderer's CSP has no unsafe-eval, but this package is also loaded by the
// preload before the document (and its CSP) exists, so zod's own eval probe
// passes there and caches "eval allowed" for the whole process. Any schema
// constructed after that then throws EvalError on its first parse inside the
// CSP-bound page (LAZ-866: login failed on the access-token parse). jitless
// disables the JIT for every schema constructed after this call, so this
// module must stay the first import of the package entry.
z.config({ jitless: true });
