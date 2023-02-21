import { UtcDate } from "@/UtcDate";
import * as Eq from "fp-ts/lib/Eq.js";
import { unsafeCoerce } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";

export type Opaque<K extends string, T> = T & { __TYPE__: K };

const opaqueCodec =
  <I, O, A, K extends string>(codec: Codec.Codec<I, O, A>) =>
  (_opaqueName: K): Codec.Codec<I, O, Opaque<K, A>> =>
    unsafeCoerce(codec) as Codec.Codec<I, O, Opaque<K, A>>;

export const stringOpaqueCodec = <I, O, A, K extends string>(_opaqueName: K) =>
  opaqueCodec<I, string, string, K>(Codec.string)(_opaqueName);

export const anyOpaqueCodec = <I, O, A, K extends string>(
  codec: Codec.Codec<I, O, A>,
  _opaqueName: K
) => opaqueCodec<I, O, A, K>(codec)(_opaqueName);

export const opaqueEq: <A, T extends Opaque<any, A>>(
  eq: Eq.Eq<A>
) => Eq.Eq<T> = (eq) => Eq.fromEquals(eq.equals);
