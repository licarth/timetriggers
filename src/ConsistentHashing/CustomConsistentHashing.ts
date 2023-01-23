import crypto from "crypto";
import _ from "lodash";

type CustomConsistentHashingProps = {
  replicas: number;
  algorithm: string;
  ring: Record<string, any>;
  keys: string[];
  nodes: string[];
};

export class CustomConsistentHashing {
  private replicas: number;
  private algorithm: string;
  private ring: Record<string, any>;
  private keys: string[];
  private nodes: string[];

  constructor({
    replicas = 160,
    algorithm = "md5",
    ring = {},
    keys = [],
    nodes = [],
  }: Partial<CustomConsistentHashingProps> = {}) {
    this.replicas = replicas;
    this.algorithm = algorithm;
    this.ring = ring;
    this.keys = keys;
    this.nodes = nodes;
  }

  static build(
    nodes: string[],
    options?: { replicas?: number; algorithm?: string }
  ) {
    let params = {
      replicas: options?.replicas ? options.replicas : undefined,
      algorithm: options?.algorithm ? options.algorithm : undefined,
    };
    const hr = new CustomConsistentHashing(params);
    for (let i = 0; i < nodes.length; i++) {
      hr.addNode(nodes[i]);
    }
    return hr;
  }

  removeNode(node: string) {
    for (var i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i] == node) {
        this.nodes.splice(i, 1);
        i--;
      }
    }

    for (var i = 0; i < this.replicas; i++) {
      var key = this.crypto(node + ":" + i);
      delete this.ring[key];

      for (var j = 0; j < this.keys.length; j++) {
        if (this.keys[j] == key) {
          this.keys.splice(j, 1);
          j--;
        }
      }
    }
  }

  addNode(node: string) {
    this.nodes.push(node);

    for (let i = 0; i < this.replicas; i++) {
      const key = this.crypto(`${node}:${i}`);

      this.keys.push(key);
      this.ring[key] = node;
    }

    this.keys.sort();
  }

  getNode(key: string) {
    if (this.getRingLength() == 0) return 0;

    var hash = this.crypto(key);
    var pos = this.getNodePosition(hash);

    return this.ring[this.keys[pos]];
  }

  getNodePosition(hash: string) {
    var upper = this.getRingLength() - 1;
    var lower = 0;
    var idx = 0;
    var comp = 0;

    if (upper == 0) return 0;

    while (lower <= upper) {
      idx = Math.floor((lower + upper) / 2);
      comp = this.compare(this.keys[idx], hash);

      if (comp == 0) {
        return idx;
      } else if (comp > 0) {
        upper = idx - 1;
      } else {
        lower = idx + 1;
      }
    }

    if (upper < 0) {
      upper = this.getRingLength() - 1;
    }

    return upper;
  }

  getRingLength() {
    return Object.keys(this.ring).length;
  }

  compare(v1: string, v2: string) {
    return v1 > v2 ? 1 : v1 < v2 ? -1 : 0;
  }

  crypto(key: string) {
    return crypto
      .createHash(this.algorithm)
      .update(key.toString())
      .digest("hex");
  }

  clone() {
    return new CustomConsistentHashing({
      replicas: this.replicas,
      algorithm: this.algorithm,
      ring: _.clone(this.ring),
      keys: _.clone(this.keys),
      nodes: _.clone(this.nodes),
    });
  }
}
