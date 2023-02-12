import { MonoTypeOperatorFunction, ObservableInput } from "rxjs";
import { operate } from "rxjs/internal/util/lift";
import { createOperatorSubscriber } from "rxjs/internal/operators/OperatorSubscriber";
import { noop } from "rxjs/internal/util/noop";
import { innerFrom } from "rxjs/internal/observable/innerFrom";

export function distinctArray<T, K>(
  keySelector?: (value: T) => K,
  flushes?: ObservableInput<any>
): MonoTypeOperatorFunction<T[]> {
  return operate((source, subscriber) => {
    const distinctKeys = new Set();
    source.subscribe(
      createOperatorSubscriber(subscriber, (value) => {
        subscriber.next(
          value.filter(
            (v) => !distinctKeys.has(keySelector ? keySelector(v) : v)
          )
        );
      })
    );

    flushes &&
      innerFrom(flushes).subscribe(
        createOperatorSubscriber(subscriber, () => distinctKeys.clear(), noop)
      );
  });
}
