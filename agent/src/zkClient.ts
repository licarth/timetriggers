import { te } from "@timetriggers/domain";
import { ZookeeperCoordinationClient } from "./Coordination/ZookeeperCoordinationClient";

(async () => {
  await te.unsafeGetOrThrow(ZookeeperCoordinationClient.build());
})();
