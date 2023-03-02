import { formatDistanceToNow } from "date-fns";

export const humanReadibleDurationFromNow = (date: Date) => {
  const duration = formatDistanceToNow(date, { addSuffix: true });
  return duration;
};
