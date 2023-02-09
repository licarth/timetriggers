import { formatDistance } from "date-fns";

export const humanReadibleMs = (ms: number) =>
  formatDistance(ms, 0, {
    includeSeconds: true,
  });
