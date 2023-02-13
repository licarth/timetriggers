/**
 * @since 0.1.0
 */
import { Task } from "fp-ts/lib/Task.js";

export const never: Task<never> = () => new Promise((_) => undefined);

export const withTimeout = <A>(
  onTimeout: A,
  millis: number
): ((ma: Task<A>) => Task<A>) => {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = () =>
    new Promise<void>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        resolve();
      }, millis);
    });

  return (ma: Task<A>) => () =>
    new Promise<A>((resolve, reject) => {
      let running = true;
      const resolveFirst = (a: A) => {
        if (running) {
          running = false;
          resolve(a);
        }
      };
      const rejectFirst = (e: any) => {
        if (running) {
          running = false;
          reject(e);
        }
      };
      ma().then((a) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolveFirst(a);
      }, rejectFirst);
      timeoutPromise().then(() => {
        resolveFirst(onTimeout);
      });
    });
};
