import { randomString } from "@/test/randomString";
import { flow, pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { ClusterNodeInformation } from "./CoordinationClient";
import { ZookeeperCoordinationClient } from "./ZookeeperCoordinationClient";

const namespace = "/" + randomString();

describe("Zookeeper CoordinationClient", () => {
  it("should take first node when no other client is connected", async () => {
    expect(
      await pipe(
        ZookeeperCoordinationClient.build({ namespace }),
        TE.chainFirstW(
          flow((client) =>
            TE.tryCatch(
              () =>
                new Promise<ClusterNodeInformation>((resolve) => {
                  client.getClusterNodeInformation().subscribe((next) => {
                    if (_.isEqual(next, { currentNodeId: 0, clusterSize: 1 })) {
                      resolve(next);
                    }
                  });
                }),
              (e) => e
            )
          )
        ),
        TE.chainW((client) => client.close()),
        TE.mapLeft((e) => console.error(e))
      )()
    ).toMatchObject({ _tag: "Right" });
  });

  it("should take second node when already 1 client is there ", async () => {
    expect(
      await pipe(
        TE.Do,
        TE.apSW(
          "firstClient",
          ZookeeperCoordinationClient.build({ namespace })
        ),
        TE.apSW(
          "otherClients",
          pipe(
            _.times(5, () => ZookeeperCoordinationClient.build({ namespace })),
            TE.sequenceArray
          )
        ),
        TE.chainFirstTaskK(
          flow(
            ({ firstClient }) =>
              TE.tryCatch(
                () =>
                  new Promise<ClusterNodeInformation>((resolve) => {
                    firstClient
                      .getClusterNodeInformation()
                      .subscribe((next) => {
                        // wait until expected result finally comes
                        if (
                          _.isEqual(next, { currentNodeId: 0, clusterSize: 6 })
                        ) {
                          resolve(next);
                        }
                      });
                  }),
                (e) => e
              ),
            TE.getOrElseW(() => TE.of(undefined))
          )
        ),
        TE.chainW(({ firstClient, otherClients }) =>
          pipe(
            [firstClient, ...otherClients].map((c) => c.close()),
            TE.sequenceArray
          )
        ),
        TE.mapLeft((e) => console.error(e))
      )()
    ).toMatchObject({ _tag: "Right" });
  });

  // it("should reconnect when disconnected", async () => {
  //   const zk = await te.unsafeGetOrThrow(
  //     ZookeeperCoordinationClient.build({ namespace })
  //   );

  //   await sleep(6 * 1000);
  //   te.unsafeGetOrThrow(zk.close());
  // });

  // it("should react on SIGINT", async () => {
  //   process.on("SIGINT", () => {
  //     fs.writeFileSync("./test", "SIGINT");
  //   });

  //   sleep(5 * 1000);
  // });
});
