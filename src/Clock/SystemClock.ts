import { Clock } from "./Clock";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  setTimeout(callback: () => void, milliseconds: number): NodeJS.Timeout {
    return setTimeout(callback, milliseconds);
  }
  clearTimeout(timeoutId: NodeJS.Timeout): void {
    clearTimeout(timeoutId);
  }
}
