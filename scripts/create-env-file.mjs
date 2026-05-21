import { writeFileSync } from "fs";
import { cpus } from "os";

const cores = cpus().length;
writeFileSync(".local.env", `NX_PARALLEL=${cores}\n`);
