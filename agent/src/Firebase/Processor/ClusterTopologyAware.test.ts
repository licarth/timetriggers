import { ZookeeperCoordinationClient } from "@/Coordination/ZookeeperCoordinationClient";
import { te, TestClock } from "@timetriggers/domain";
import { InMemoryDataStore } from "./InMemoryDataStore";
import { TestClusterTopologyDatastoreAware } from "./TestClusterTopologyDatastoreAware";

describe("ClusterTopologyAware", () => {
  let coordinationClient: ZookeeperCoordinationClient;

  beforeEach(async () => {
    coordinationClient = await te.unsafeGetOrThrow(
      ZookeeperCoordinationClient.build({
        namespace: "/test",
      })
    );
  });

  afterEach(async () => {
    await te.unsafeGetOrThrow(coordinationClient.close());
  });

  it("should be created properly", async () => {
    const clock = new TestClock();
    const clusterTopologyDatastoreAware = await te.unsafeGetOrThrow(
      TestClusterTopologyDatastoreAware.build({
        clock,
        datastore: InMemoryDataStore.factory({ clock }),
        coordinationClient,
      })
    );
  });
});
