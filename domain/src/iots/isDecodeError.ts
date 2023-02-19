import { DecodeError, draw } from "io-ts/lib/Decoder.js";

export const isDecodeError = (e: unknown): e is DecodeError => {
  try {
    draw(e as unknown as DecodeError);
    return true;
  } catch {
    console.log("not a decode error");
    return false;
  }
};
