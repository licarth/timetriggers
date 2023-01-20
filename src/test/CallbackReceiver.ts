import { JobId } from "@/JobId";
import express from "express";
import getPort from "get-port";

/**
 * In tests, this is used to act as a client we want to send callbacks to.
 */
export class CallbackReceiver {
  private app;
  private server;
  port;

  private callbackIdsReceived: string[] = [];

  private constructor({
    app,
    server,
    port,
  }: {
    app: express.Application;
    server: ReturnType<express.Application["listen"]>;
    port: number;
  }) {
    this.app = app;
    this.server = server;
    this.port = port;

    app.post("/", async (req, res) => {
      await sleepRandom(0, 500);
      res.sendStatus(200);
      this.callbackIdsReceived.push(req.body.callbackId);
    });
  }

  getCallbackIdsReceived() {
    return this.callbackIdsReceived;
  }

  async waitForCallback(callbackId: JobId, maxWaitTime = 4500) {
    return this.waitForCallbackR(callbackId, maxWaitTime);
  }

  private async waitForCallbackR(
    callbackId: JobId,
    maxWaitTime = 10000,
    startTime = Date.now(),
    interval = 500
  ) {
    if (this.callbackIdsReceived.includes(callbackId)) {
      return;
    } else {
      return new Promise((resolve, reject) => {
        if (maxWaitTime < Date.now() - startTime) {
          reject(new Error(`Timeout waiting for callback ${callbackId}`));
        } else {
          setTimeout(() => {
            if (this.callbackIdsReceived.includes(callbackId)) {
              clearTimeout(interval);
              resolve(void 0);
            } else {
              this.waitForCallbackR(
                callbackId,
                maxWaitTime,
                startTime,
                interval
              ).then(resolve);
            }
          }, interval);
        }
      });
    }
  }

  static async build() {
    const app = express();

    app.use(express.json());

    const port = await getPort();

    const server = app.listen(port, () => {});

    return new this({ app, server, port });
  }

  async close() {
    this.server.close();
  }
}

const sleepRandom = (min: number, max: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.random() * (max - min) + min);
  });
};
