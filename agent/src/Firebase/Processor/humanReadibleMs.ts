import { differenceInMilliseconds, formatDistance } from "date-fns";

export const humanReadibleMs = (ms: number) =>
  formatDistance(ms, 0, {
    includeSeconds: true,
  });

export const humanReadibleCountdownBetween2Dates = (
  refDate: Date,
  date: Date
) =>
  formatDistance(differenceInMilliseconds(refDate, date), 0, {
    includeSeconds: true,
  });
