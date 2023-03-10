import { Clock } from "@/Clock";
import { isValid, parseISO } from "date-fns";
import { zonedTimeToUtc } from "date-fns-tz";

const parseIsoUTC = (s: string) => zonedTimeToUtc(parseISO(s), "UTC");

export const evaluateDateFunctionsString =
  (s: string) =>
  ({ clock }: { clock: Clock }) => {
    // s looks like '2021-01-01T00:00:00.000Z | add -1h'
    const elements = s.split("|");
    const dateString = elements[0].trim();
    let date: Date;
    if (dateString === "now") {
      date = clock.now();
    } else {
      date = parseIsoUTC(dateString);
      if (!isValid(date)) {
        throw new Error(`Cannot parse date '${dateString}'`);
      }
    }
    if (elements.length === 1) {
      return date;
    } else if (elements.length > 2) {
      throw new Error(
        `Cannot parse '${s}', max. one operation on dates currently supported`
      );
    } else {
      const operation = elements[1].trim();
      // Accept many spaces between the operation and the amount
      const [operator, amountAndUnit] = operation.split(/\s+(.*)/s);
      if (operator === "add") {
        const regexp =
          /^([+-]?\s*\d+)\s*((?:[smhd]|second|seconds|months|month|months|year|years))$/;
        const match = regexp.exec(amountAndUnit);
        if (!match) {
          throw new Error(`Cannot parse amountAndUnit '${amountAndUnit}'`);
        }
        const amount = Number(match[1].replace(/\s/g, ""));
        const unit = match[2];
        const dateToReturn = add(unit, date, amount);
        // const amount = Number(operationElements[1].slice(0, -1));
        // const unit = operationElements[1].slice(-1).trim();
        if (!isValid(dateToReturn)) {
          throw new Error(
            `Invalid Date after operation '${operation}' on '${dateString}'`
          );
        }
        return dateToReturn;
      } else {
        throw new Error(`Unknown operation ${operation}`);
      }
    }
  };

function add(unit: string, date: Date, amount: number) {
  switch (unit) {
    case "s":
      return new Date(date.getTime() + amount * 1000);
    case "m":
      return new Date(date.getTime() + amount * 60 * 1000);
    case "h":
      return new Date(date.getTime() + amount * 60 * 60 * 1000);
    case "d":
      return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
    case "month" || "months":
      return new Date(
        date.getFullYear(),
        date.getMonth() + amount,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds()
      );
    case "year" || "years":
      return new Date(
        date.getFullYear() + amount,
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds()
      );
    default:
      throw new Error(`Unknown unit ${unit}`);
  }
}
