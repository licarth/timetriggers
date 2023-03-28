import {
  Datastore,
  GetJobsScheduledBeforeArgs,
  WaitForRegisteredJobsByRegisteredAtArgs,
} from "@/Firebase/Processor/Datastore";
import { ShardsToListenTo } from "@/Firebase/Processor/ShardsToListenTo";
import { PrismaClient } from "@prisma/client";
import {
  Clock,
  HttpCallCompleted,
  HttpCallErrored,
  JobDefinition,
  JobDocument,
  JobId,
  JobStatus,
  QueuedAt,
  RateLimit,
} from "@timetriggers/domain";
import * as TE from "fp-ts/lib/TaskEither.js";
import { Observable, of } from "rxjs";

type PrismaDatastoreProps = {
  clock: Clock;
};
export class PrismaDatastore implements Datastore {
  prisma;
  clock;

  private constructor({ clock }: PrismaDatastoreProps) {
    this.prisma = new PrismaClient();
    this.clock = clock;
  }

  static build({ clock }: PrismaDatastoreProps) {
    return new PrismaDatastore({ clock });
  }

  schedule(jobDocument: JobDocument): TE.TaskEither<any, JobId> {
    return TE.tryCatch(
      async () => {
        const jobDefinitionObject = JobDefinition.codec("string").encode(
          jobDocument.jobDefinition
        );
        const jobDefinitionBuffer = Buffer.from(
          JSON.stringify(jobDefinitionObject)
        );
        await this.prisma.jobDocument.create({
          data: {
            jobId: jobDocument.id(),
            ...stripPrisma(
              this.prisma.jobDocument,
              JobDocument.codec("string").encode(jobDocument)
            ),
            jobDefinition: jobDefinitionBuffer,
            scheduledAt: jobDocument.jobDefinition.scheduledAt,
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
            // TODO
            // project: {
            // },
          },
        });
        return jobDocument.id();
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
    { maxNoticePeriodMs }: WaitForRegisteredJobsByRegisteredAtArgs,
    shardsToListenTo?: ShardsToListenTo | undefined
  ): TE.TaskEither<string, Observable<JobDocument[]>> {
    // TODO do repeatidly, wait for new entries. How to do that? => regularily select jobs after a
    // This is for short-notice jobs registered within x seconds, minutes, etc.
    // This returns the same jobs most of the time, keeps in memory the jobs
    // it already knows about / reported in the Observable and exclude them from the query

    this.prisma.jobDocument.findMany({
      where: {
        status: {
          value: "registred",
          // registeredAt: {
          //   lte: new Date(this.clock.now().getTime()),
          // },
        },
      },
    });

    return TE.of(of([]));
  }

  getRegisteredJobsByScheduledAt(
    {
      maxScheduledAt,
      minScheduledAt,
      limit,
      lastKnownJob,
    }: GetJobsScheduledBeforeArgs,
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
    return TE.tryCatch(
      async () => {
        await this.prisma.jobStatus.updateMany({
          where: {
            jobId: {
              in: jobDefinition.map((j) => j.id),
            },
          },
          data: {
            value: "queued",
            queuedAt: QueuedAt.fromDate(this.clock.now()),
          },
        });
      },
      (e) => {
        console.error(`[Prisma] Error while queueing jobs`, e);
        return e;
      }
    );
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
