import { AbstractClock } from "./AbstractClock";

export class SystemClock extends AbstractClock {
  now(): Date {
    return new Date();
  }
  setTimeout(callback: () => void, milliseconds: number): NodeJS.Timeout {
    return setTimeout(callback, milliseconds);
  }
  clearTimeout(timeoutId: NodeJS.Timeout): void {
    clearTimeout(timeoutId);
  }

  tickMs(milliseconds: number) {
    // This has no eeffect on the system clock
  }
}
