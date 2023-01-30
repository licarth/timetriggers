import { TestClock } from "@/Clock/TestClock";
import { ZookeeperCoordinationClient } from "@/Coordination/ZookeeperCoordinationClient";
import { te } from "@/fp-ts";
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
    const clusterTopologyDatastoreAware = await te.unsafeGetOrThrow(
      TestClusterTopologyDatastoreAware.build({
        clock: new TestClock(new Date("2020-01-01T00:00:00.000Z")),
        datastore: InMemoryDataStore.factory(),
        coordinationClient,
      })
    );
  });
});
