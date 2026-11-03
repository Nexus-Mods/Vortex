import type { IBenchmark } from "../types";
import { filesystemEnumerate } from "./filesystemEnumerate";

export const benchmarks: IBenchmark[] = [filesystemEnumerate];
