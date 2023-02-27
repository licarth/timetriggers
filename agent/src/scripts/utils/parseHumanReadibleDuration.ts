export const parseHumanReadibleDuration = (duration: string) => {
  // e.g. "10s", "2m", "3h"
  const matches = duration.match(/(\d+)([a-z])/i);
  if (!matches) {
    throw new Error(`Cannot parse duration ${duration}`);
  }
  const [number, unit] = matches.slice(1);
  const numberAsInt = parseInt(number);
  switch (unit) {
    case "s":
      return numberAsInt * 1000;
    case "m":
      return numberAsInt * 1000 * 60;
    case "h":
      return numberAsInt * 1000 * 60 * 60;
    default:
      throw new Error(`Cannot parse duration ${unit}`);
  }
};
