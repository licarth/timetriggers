import * as C from "io-ts/lib/Codec.js";
import { MonthlyUsageV1 } from "./MonthlyUsageV1";
import { MonthlyUsageV2 } from "./MonthlyUsageV2";

export namespace MonthlyUsage {
  export const codec = C.sum("_version")({
    1: MonthlyUsageV1.codec,
    2: MonthlyUsageV2.codec,
  });
}

export type MonthlyUsage = C.TypeOf<typeof MonthlyUsage.codec>;
