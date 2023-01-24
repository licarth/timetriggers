import axios from "axios";
import { Observable, Subscriber } from "rxjs";
import { Clock } from "./Clock/Clock";
import { SystemClock } from "./Clock/SystemClock";
import { HttpCallCompleted } from "./HttpCallStatusUpdate/HttpCallCompleted";
import { HttpCallErrored } from "./HttpCallStatusUpdate/HttpCallErrored";
import { HttpCallResponse } from "./HttpCallStatusUpdate/HttpCallResponse";
import { HttpCallStarted } from "./HttpCallStatusUpdate/HttpCallStarted";
import { HttpCallStatusUpdate } from "./HttpCallStatusUpdate/HttpCallStatusUpdate";
import { StatusCode } from "./HttpCallStatusUpdate/StatusCode";
import { JobDefinition } from "./domain/JobDefinition";
import { Worker } from "./Worker";
import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";

type AxiosWorkerProps = {
  clock?: Clock;
  releaseFromPool?: (axiosWorker: AxiosWorker) => TE.TaskEither<Error, void>;
};

export class AxiosWorker implements Worker {
  clock;
  releaseFromPool;

  constructor(props: AxiosWorkerProps) {
    this.clock = props.clock || new SystemClock();
    this.releaseFromPool = props.releaseFromPool;
  }

  execute(jobDefinition: JobDefinition): Observable<HttpCallStatusUpdate> {
    return new Observable<HttpCallStatusUpdate>((subscriber) => {
      this._execute(jobDefinition, subscriber);
    });
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  private async _execute(
    jobDefinition: JobDefinition,
    subscriber: Subscriber<HttpCallStatusUpdate>
  ) {
    const startedAt = this.clock.now();
    try {
      subscriber?.next(new HttpCallStarted({ startedAt }));
      const axiosResponse = await axios.post(jobDefinition.url, {
        callbackId: jobDefinition.id,
      });
      subscriber.next(
        new HttpCallCompleted({
          startedAt,
          completedAt: this.clock.now(),
          response: HttpCallResponse.fromAxiosResponse(axiosResponse),
        })
      );
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (e.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          subscriber.next(
            new HttpCallCompleted({
              startedAt,
              completedAt: this.clock.now(),
              response: HttpCallResponse.fromAxiosResponse(e.response),
            })
          );
        } else if (e.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          subscriber.next(
            new HttpCallErrored({
              startedAt,
              errorMessage: e.message,
            })
          );
        } else {
          // Something happened in setting up the request that triggered an Error
          subscriber.next(
            new HttpCallErrored({
              startedAt,
              errorMessage: e.message,
            })
          );
        }
      } else if (e instanceof Error) {
        subscriber.next(
          new HttpCallErrored({
            startedAt,
            errorMessage: e.message,
          })
        );
      }
    } finally {
      subscriber.complete();
      this.releaseFromPool &&
        pipe(
          this.releaseFromPool(this),
          TE.mapLeft((e) => {
            console.log(e);
          })
        )();
    }
  }
}
