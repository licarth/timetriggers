import { e } from "@/fp-ts";
import { MyUnversionedObject } from "./taggedVersionClassCodec/tests/MyUnversionedObject";
import { MyUnversionedObjectV1 as MyUnversionedObjectV1 } from "./taggedVersionClassCodec/tests/MyUnversionedObjectVersioned";

describe("fromClassCodecNotExtends", () => {
  it("should encode an object without version with _version = 1", () => {
    const myUnversionedObject = new MyUnversionedObject({
      incompatibleProp: "hello",
    });
    const encoded = MyUnversionedObject.codec.encode(myUnversionedObject);
    console.log(encoded);
    expect(encoded).toMatchObject({
      _tag: "MyUnversionedObject",
      //   _version: 1,
    });
  });

  //   it("should decode an object without version with _version = 1", () => {
  //     const decoded = e.unsafeGetOrThrow(
  //       MyUnversionedObjectV1.codec.decode({
  //         _tag: "MyUnversionedObject",
  //         incompatibleProp: "hello",
  //       })
  //     );
  //     console.log(decoded);
  //     expect(decoded).toMatchObject({
  //       _tag: "MyUnversionedObject",
  //       _version: 1,
  //     });
  // //   });
  //   it("should decode an object without version with _version = 1", () => {
  //     const decoded = e.unsafeGetOrThrow(
  //       MyUnversionedObjectV1.codec.decode({
  //         _tag: "MyUnversionedObject",
  //         incompatibleProp: "hello",
  //       })
  //     );
  //     console.log(decoded);
  //     expect(decoded).toMatchObject({
  //       _tag: "MyUnversionedObject",
  //       _version: 1,
  //     });
  //   });

  it("should fail to decode version _version = 2", () => {
    const o = {
      _tag: "MyUnversionedObject",
      _version: 2,
      incompatibleProp: "hello",
    };

    expect(() =>
      e.unsafeGetOrThrow(MyUnversionedObjectV1.codec.decode(o))
    ).toThrow();
  });
});
