import * as E from "fp-ts/lib/Either.js";
import { Url } from "./Url";

describe("Url", () => {
  describe("parse", () => {
    it("should fail on malformed protocol", () => {
      expect(Url.parse("'http://malformed-url")).toEqual(
        E.left("not a valid url")
      );
    });
  });
});
