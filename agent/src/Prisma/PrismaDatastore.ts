import {
  Datastore,
  GetJobsScheduledBeforeArgs,
  WaitForRegisteredJobsByRegisteredAtArgs,
} from "@/Firebase/Processor/Datastore";
import { ShardsToListenTo } from "@/Firebase/Processor/ShardsToListenTo";
import { PrismaClient } from "@prisma/client";
import {
  HttpCallCompleted,
  HttpCallErrored,
  JobDefinition,
  JobDocument,
  JobId,
  JobStatus,
  RateLimit,
} from "@timetriggers/domain";
import * as TE from "fp-ts/lib/TaskEither.js";
import { Observable, of } from "rxjs";

export class PrismaDatastore implements Datastore {
  prisma;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static build() {
    return new PrismaDatastore();
  }

  schedule(jobDocument: JobDocument): TE.TaskEither<any, JobId> {
    return TE.tryCatch(
      async () => {
        const newVariable = stripPrisma(
          this.prisma.jobDocument,
          JobDocument.codec("string").encode(jobDocument)
        );
        console.log("newVariable", newVariable);
        await this.prisma.jobDocument.create({
          data: {
            jobId: jobDocument.id(),
            ...newVariable,
            projectId: undefined,
            statusId: undefined,
            status: {
              create: {
                jobId: jobDocument.id(),
                ...stripPrisma(
                  this.prisma.jobStatus,
                  JobStatus.codec("string").encode(jobDocument.status)
                ),
              },
            },
            // project: {
            //   connectOrCreate: {
            //     projectId: jobDocument.projectId,
            //   },
            // },
          },
        });
        return "1" as JobId;
      },
      (e) => {
        console.error(`Error while scheduling job ${jobDocument.id()}`, e);
        return e;
      }
    );
  }
  cancel(jobId: JobId): TE.TaskEither<any, void> {
    return TE.of(undefined);
  }
  waitForRegisteredJobsByRegisteredAt(
    args: WaitForRegisteredJobsByRegisteredAtArgs,
    shardsToListenTo?: ShardsToListenTo | undefined
  ): TE.TaskEither<string, Observable<JobDocument[]>> {
    return TE.of(of([]));
  }
  getRegisteredJobsByScheduledAt(
    args: GetJobsScheduledBeforeArgs,
    shardsToListenTo?: ShardsToListenTo | undefined
  ): TE.TaskEither<any, JobDocument[]> {
    return TE.of([]);
  }
  waitForNextJobsInQueue(
    shardsToListenTo?: ShardsToListenTo | undefined
  ): TE.TaskEither<Error, Observable<JobDocument[]>> {
    return TE.of(of([]));
  }
  queueJobs(jobDefinition: JobDefinition[]): TE.TaskEither<any, void> {
    return TE.of(undefined);
  }
  markRateLimited(
    jobDocument: JobDocument,
    rateLimits: RateLimit[]
  ): TE.TaskEither<any, void> {
    return TE.of(undefined);
  }
  listenToRateLimits(
    shardsToListenTo?: ShardsToListenTo | undefined
  ): TE.TaskEither<any, Observable<RateLimit[]>> {
    return TE.of(of([]));
  }
  markRateLimitSatisfied(rateLimit: RateLimit): TE.TaskEither<any, void> {
    return TE.of(undefined);
  }
  markAsDead(jobId: JobId): TE.TaskEither<any, void> {
    return TE.of(undefined);
  }

  markJobAsRunning(args: {
    jobId: JobId;
    status: JobStatus;
  }): TE.TaskEither<any, void> {
    return TE.of(undefined);
  }

  markJobAsComplete(args: {
    jobId: JobId;
    lastStatusUpdate: HttpCallCompleted | HttpCallErrored;
    status: JobStatus;
  }): TE.TaskEither<any, void> {
    return TE.of(undefined);
  }
  close(): TE.TaskEither<any, void> {
    return TE.of(undefined);
  }
}

function stripPrisma<T extends {}>(input: { fields: {} }, data: T): T {
  const validKeys = Object.keys(input.fields);
  const dataCopy: any = { ...data };
  for (const key of Object.keys(data)) {
    if (!validKeys.includes(key)) {
      delete dataCopy[key];
    }
  }
  return dataCopy as T;
}
