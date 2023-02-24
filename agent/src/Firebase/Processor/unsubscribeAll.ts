import { UnsubsribeHook } from "./Processor";

export const unsubscribeAll = (hooks: UnsubsribeHook[]) => {
  while (hooks.length > 0) {
    hooks.pop()?.();
  }
};
