import { JobId } from "@/JobId";
import express from "express";

/**
 * In tests, this is used to act as a client we want to send callbacks to.
 */
export class CallbackReceiver {
  private app;
  private server;

  private callbackIdsReceived: string[] = [];

  private constructor({
    app,
    server,
  }: {
    app: express.Application;
    server: ReturnType<express.Application["listen"]>;
  }) {
    this.app = app;
    this.server = server;

    app.post("/", (req, res) => {
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

  static async build({ port = 3001 }: { port?: number } = {}) {
    const app = express();

    app.use(express.json());

    const server = app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });

    return new this({ app, server });
  }

  async close() {
    this.server.close();
  }
}
