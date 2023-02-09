import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { te } from "./te";

describe("repeatUntil", () => {
  it("should repeat until 10", async () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(
      await te.unsafeGetOrThrow(
        pipe(
          async () => numbers.shift() as number,
          TE.fromTask,
          te.repeatUntil((n: number) => n === 10)
        )
      )
    ).toBe(10);
  });
  it("should repeat until 10", async () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(
      await te.unsafeGetOrThrow(
        pipe(
          async () => numbers.shift() as number,
          TE.fromTask,
          te.repeatUntil((n: number) => n === 10, { maxAttempts: 10 })
        )
      )
    ).toBe(10);
  });
  it("should succeed at maxAttempts", async () => {
    const numbers = [1, 2, 3];
    expect(
      await te.unsafeGetOrThrow(
        pipe(
          async () => numbers.shift() as number,
          TE.fromTask,
          te.repeatUntil((n) => n === 3, { maxAttempts: 3 })
        )
      )
    ).toBe(3);
  });

  it("should increment an offset", async () => {
    let offset = 0;
    expect(
      await te.unsafeGetOrThrow(
        pipe(
          async () => (offset = offset + 1),
          TE.fromTask,
          te.repeatUntil(() => offset === 2, { maxAttempts: 10 })
        )
      )
    ).toBe(2);
  });

  it("should return Left if max attempts reached", async () => {
    const numbers = [1, 2, 3];
    await expect(async () =>
      te.unsafeGetOrThrow(
        pipe(
          async () => numbers.shift() as number,
          TE.fromTask,
          te.repeatUntil((n) => n === 3, { maxAttempts: 2 })
        )
      )
    ).rejects.toThrow(new Error("Max attempts reached"));
  });
});
