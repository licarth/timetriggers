import { TestClock } from "@/Clock/TestClock";
import { JobDefinition } from "@/domain/JobDefinition";
import { ScheduledAt } from "@/domain/ScheduledAt";
import { Shard } from "@/domain/Shard";
import { te } from "@/fp-ts";
import { addMilliseconds } from "date-fns";
import { firstValueFrom } from "rxjs";
import { Datastore } from "./Datastore";
import { InMemoryDataStore } from "./InMemoryDataStore";

describe("InMemoryDataStore", () => {
  //   describe("schedule", () => {
  //     it("should schedule a job properly", async () => {
  //       const clock = new TestClock();
  //       const pollingInterval = 100;
  //       const datastore = InMemoryDataStore.factory({
  //         clock,
  //         pollingInterval,
  //       });
  //       await te.unsafeGetOrThrow(
  //         datastore.schedule(
  //           JobDefinition.factory({
  //             scheduledAt: ScheduledAt.fromDate(
  //               addMilliseconds(clock.now(), 1000)
  //             ),
  //           })
  //         )
  //       );
  //       let jobDefs: JobDefinition[] = [];
  //       datastore
  //         .listenToNewlyRegisteredJobs({ millisecondsFromNow: 1000 })
  //         .subscribe((jobs) => {
  //           jobDefs = jobs;
  //         });
  //       clock.tickMs(pollingInterval);
  //       expect(jobDefs.length).toBe(1);
  //     });
});

//   describe("listenToNewJobsBefore", () => {
//     it("should not return a job that's planned beyond", async () => {
//       const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));

//       const pollingInterval = 100;

//       const datastore = InMemoryDataStore.factory({
//         clock,
//         pollingInterval,
//       });
//       await te.unsafeGetOrThrow(
//         datastore.schedule(
//           JobDefinition.factory({
//             scheduledAt: ScheduledAt.fromDate(
//               addMilliseconds(clock.now(), 1000)
//             ),
//           })
//         )
//       );

//       let jobDefs: JobDefinition[] = [];
//       datastore
//         .listenToNewlyRegisteredJobs({ millisecondsFromNow: 500 })
//         .subscribe((jobs) => {
//           jobDefs = jobs;
//         });
//       clock.tickMs(pollingInterval);
//       expect(jobDefs.length).toBe(0);
//     });
//   });
// });

// describe("Sharded InMemoryDatastore", () => {
//   describe("listenToNewJobsBefore", () => {
//     it("should return only jobs in shard", async () => {
//       const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
//       const pollingInterval = 100;
//       const datastore = InMemoryDataStore.factory({
//         clock,
//         pollingInterval,
//       });
//       await Promise.all([
//         te.unsafeGetOrThrow(
//           datastore.schedule(JobDefinition.factory({ clock }), (id) => [
//             Shard.of(0, 2),
//           ])
//         ),
//         te.unsafeGetOrThrow(
//           datastore.schedule(JobDefinition.factory({ clock }), (id) => [
//             Shard.of(1, 2),
//           ])
//         ),
//       ]);

//       const jobsPromise = firstValueFrom(
//         datastore.listenToNewlyRegisteredJobs(
//           {
//             millisecondsFromNow: 1000,
//           },
//           { nodeCount: 2, nodeIds: [1] }
//         )
//       );

//       clock.tickMs(pollingInterval);

//       await jobsPromise.then((jobs) => {
//         expect(jobs.length).toBe(1);
//       });
//     });

//     it("should all jobs if nodeCount is 1", async () => {
//       const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
//       const pollingInterval = 100;
//       const datastore = InMemoryDataStore.factory({
//         clock,
//         pollingInterval,
//       });
//       await Promise.all([
//         te.unsafeGetOrThrow(
//           datastore.schedule(JobDefinition.factory({ clock }), (id) => [
//             Shard.of(0, 2),
//           ])
//         ),
//         te.unsafeGetOrThrow(
//           datastore.schedule(JobDefinition.factory({ clock }), (id) => [
//             Shard.of(1, 2),
//           ])
//         ),
//       ]);

//       const jobsPromise = firstValueFrom(
//         datastore.listenToNewlyRegisteredJobs(
//           {
//             millisecondsFromNow: 1000,
//           },
//           { nodeCount: 1, nodeIds: [] }
//         )
//       );

//       clock.tickMs(pollingInterval);

//       await jobsPromise.then((jobs) => {
//         expect(jobs.length).toBe(2);
//       });
//     });
//   });
// });
