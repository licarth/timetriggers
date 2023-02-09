export interface Clock {
  now(): Date;
  setTimeout(callback: () => void, milliseconds: number): NodeJS.Timeout;
  clearTimeout(timeoutId: NodeJS.Timeout): void;
  setInterval(callback: () => void, milliseconds: number): NodeJS.Timeout;
  clearInterval(intervalId: NodeJS.Timeout): void;
}
