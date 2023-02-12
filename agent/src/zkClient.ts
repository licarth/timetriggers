import { ZookeeperCoordinationClient } from "./Coordination/ZookeeperCoordinationClient";
import { te } from "./fp-ts";

(async () => {
  await te.unsafeGetOrThrow(ZookeeperCoordinationClient.build());
})();
