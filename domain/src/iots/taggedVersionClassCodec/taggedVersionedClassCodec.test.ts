import { e } from "@/fp-ts";
import { pipe } from "fp-ts/lib/function";
import { draw } from "io-ts/lib/Decoder";
import { MyObject } from "./tests/MyObject";
import { MyObjectV1 } from "./tests/MyObjectV1";
import { MyObjectV2 } from "./tests/MyObjectV2";
import * as E from "fp-ts/lib/Either";
import { AnObject } from "./tests/AnObject";
import { MyOtherObjectV1 } from "./tests/MyOtherObjectV1";

describe("taggedVersionedClassCodec", () => {
  const myObjectV1 = new MyObjectV1({ incompatibleProp: "hello" });
  const myObjectV2 = new MyObjectV2({ incompatibleProp: 1 });
  const myOtherObjectV1 = new MyOtherObjectV1({ anotherProp: ["element1"] });

  it("should encode and decode", () => {
    const myObjectV1Encoded = MyObject.codec.encode(myObjectV1);
    const myObjectV2Encoded = MyObject.codec.encode(myObjectV2);
    const myOtherObjectV1Encoded =
      MyOtherObjectV1.codec.encode(myOtherObjectV1);

    console.log(myOtherObjectV1Encoded);
    console.log(
      e.unsafeGetOrThrow(
        pipe(
          AnObject.codec.decode(myOtherObjectV1Encoded),
          E.mapLeft((e) => draw(e))
        )
      )
    );
  });
});
