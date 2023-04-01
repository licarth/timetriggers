import { anyOpaqueCodec } from "@/iots";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function";
import * as C from "io-ts/lib/Codec.js";

export namespace Url {
  export const codec = anyOpaqueCodec(C.string, "Url");

  const parseThrows = (url: unknown) => {
    if (typeof url !== "string") {
      throw "url is not a string" as const;
    }

    new URL(url); // Just to make sure it's a valid url

    return url as Url;
  };

  export const parse = (url: unknown) =>
    pipe(
      E.tryCatch(
        () => parseThrows(url),
        (e: unknown) => "not a valid url" as const
      )
    );
  export const localhost = (port: number): Url =>
    `http://localhost:${port}` as Url;

  export const factory = (url: string): Url => Url.localhost(3000);
}
export type Url = C.TypeOf<typeof Url.codec>;
