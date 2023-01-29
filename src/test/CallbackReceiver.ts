import { JobId } from "@/domain/JobId";
import express from "express";
import getPort from "get-port";
import { RequestHandler } from "express";

type PostHandler = (
  markAsReceived: (callbackId: string) => void
) => RequestHandler;

type CallbackReceiverProps = {
  postHandler?: PostHandler;
};

/**
 * In tests, this is used to act as a client we want to send callbacks to.
 */
export class CallbackReceiver {
  private app;
  private server;
  port;
  postHandler;

  private callbackIdsReceived: string[] = [];

  private constructor(props: {
    app: express.Application;
    server: ReturnType<express.Application["listen"]>;
    port: number;
    postHandler: PostHandler;
  }) {
    this.app = props.app;
    this.server = props.server;
    this.port = props.port;

    this.postHandler = props.postHandler;

    this.app.post(
      "/",
      this.postHandler((callbackId) => {
        this.callbackIdsReceived.push(callbackId);
      })
    );
  }

  getCallbackIdsReceived() {
    return this.callbackIdsReceived;
  }

  async waitForCallback(callbackId: JobId, maxWaitTime = 4500) {
    return this.waitForCallbackR(callbackId, maxWaitTime);
  }

  async waitForAllCallbacks(callbackIds: JobId[]) {
    return Promise.all(
      callbackIds.map((callbackId) => this.waitForCallback(callbackId))
    );
  }

  private async waitForCallbackR(
    callbackId: JobId,
    startTime = Date.now(),
    interval = 500
  ) {
    if (this.callbackIdsReceived.includes(callbackId)) {
      return;
    } else {
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (this.callbackIdsReceived.includes(callbackId)) {
            resolve(void 0);
          } else {
            this.waitForCallbackR(callbackId, startTime, interval).then(() =>
              resolve(void 0)
            );
          }
        }, interval);
      });
    }
  }

  static async factory(props: CallbackReceiverProps = {}) {
    const postHandler =
      props.postHandler ||
      ((markAsReceived) => async (req, res) => {
        markAsReceived(req.body.callbackId);
        // just hung up
        randomlyChoseBetween(
          () => res.sendStatus(randomStatus()),
          () => res.destroy()
        );
      });

    const app = express();

    app.use(express.json());

    const port = await getPort();

    const server = app.listen(port, () => {});

    return new this({ app, server, port, postHandler });
  }

  async close() {
    await new Promise<void>((resolve) =>
      this.server.close(() => {
        resolve();
      })
    );
  }
}

const sleepRandom = (min: number, max: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.random() * (max - min) + min);
  });
};

const randomlyChoseBetween = (...fns: (() => void)[]) => {
  const fn = fns[Math.floor(Math.random() * fns.length)];
  fn();
};

const randomStatus = () => {
  const statuses = [200, 200, 200, 200, 401, 500];
  return statuses[Math.floor(Math.random() * statuses.length)];
};
