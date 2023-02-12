import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";

export class Shard {
  nodeId;
  nodeCount;

  constructor(props: ShardProps) {
    this.nodeId = props.nodeId;
    this.nodeCount = props.nodeCount;
  }

  static propsCodec = Codec.struct({
    nodeId: Codec.number,
    nodeCount: Codec.number,
  });

  static codec = pipe(Shard.propsCodec, Codec.compose(fromClassCodec(Shard)));

  static of = (nodeId: number, nodeCount: number) =>
    new Shard({ nodeId, nodeCount });

  toString() {
    return `${this.nodeCount}-${this.nodeId}`;
  }
}

export type ShardProps = Codec.TypeOf<typeof Shard.propsCodec>;
