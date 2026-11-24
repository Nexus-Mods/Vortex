import { getErrorMessageOrDefault, type FeedbackRecord } from "@vortex/shared";
import type {
  FeedbackSendFailure,
  FeedbackSendResult,
  IFeedbackSendProgress,
  IFeedbackSendRequest,
} from "@vortex/shared/ipc";

import { log } from "../logging";
import { collectFeedbackContent, type IFeedbackSources } from "./collect";
import { buildFeedbackRecords } from "./records";
import {
  FeedbackCanceled,
  FeedbackSendError,
  sendFeedback,
  type ISendFeedbackOptions,
} from "./send";
import { createFeedbackSender } from "./service";

export interface IFeedbackJobsOptions {
  sources: IFeedbackSources;
  /** the service's address, without the path */
  baseUrl: () => string;
  /** this app's version, sent as the client's */
  version: () => string;
  fetch?: typeof fetch;
  sleep?: ISendFeedbackOptions["sleep"];
}

/** One feedback as main builds and sends it, kept so that sending it again picks up where it stopped. */
interface IJob {
  /**
   * The records, built once on the first send. A send that starts while they are still being built
   * waits on the same build, so every attempt sends the very same records.
   */
  records: Promise<FeedbackRecord[]> | undefined;
  /** requests the service has stored so far, of how many */
  sent: number;
  total: number;
  controller: AbortController | undefined;
}

/**
 * Feedbacks kept between attempts. Each holds its records, which with support data can run to
 * megabytes, and a dialog has one open at a time; this bounds what a renderer that went away
 * without discarding them leaves behind.
 */
const MAX_KEPT_JOBS = 3;

const failed = (reason: FeedbackSendFailure, message: string): FeedbackSendResult => ({
  status: "failed",
  reason,
  message,
});

/**
 * Builds and sends feedbacks by their id. The service stores a record id once, so a retry has to
 * send exactly the records the failed attempt did: they are built on the first send and kept, and
 * a retry skips the requests that were already stored. The renderer gives a feedback a new id
 * whenever the user changes it, so the same id always means the same feedback.
 */
export class FeedbackJobs {
  readonly #options: IFeedbackJobsOptions;
  readonly #jobs = new Map<string, IJob>();

  constructor(options: IFeedbackJobsOptions) {
    this.#options = options;
  }

  public async send(request: IFeedbackSendRequest, token: string): Promise<FeedbackSendResult> {
    const { feedbackId } = request;
    const job = this.#job(feedbackId);
    // a second send of the same feedback takes over from the first
    job.controller?.abort();
    const controller = new AbortController();
    job.controller = controller;
    const { signal } = controller;

    try {
      if (job.records === undefined) {
        const building = collectFeedbackContent(request, this.#options.sources).then(
          buildFeedbackRecords,
        );
        job.records = building;
        // a build that failed is not kept, so the next send tries again
        building.catch(() => {
          if (job.records === building) job.records = undefined;
        });
      }
      const records = await job.records;
      if (signal.aborted) return { status: "canceled" };

      const sender = createFeedbackSender({
        baseUrl: this.#options.baseUrl(),
        client: {
          name: "vortex",
          version: this.#options.version(),
          instanceId: request.instanceId,
        },
        token,
        signal,
        fetch: this.#options.fetch,
      });
      await sendFeedback(sender, feedbackId, new Date(request.createdAt), records, {
        signal,
        startAt: job.sent,
        sleep: this.#options.sleep,
        onProgress: (sent, total) => {
          job.sent = sent;
          job.total = total;
        },
      });
      // every record is stored, so there is nothing left to pick up
      this.#jobs.delete(feedbackId);
      return { status: "sent" };
    } catch (err) {
      if (err instanceof FeedbackCanceled || signal.aborted) {
        return { status: "canceled" };
      }
      if (err instanceof FeedbackSendError) {
        return failed(err.reason, err.message);
      }
      log("warn", "failed to build or send feedback", {
        feedbackId,
        error: getErrorMessageOrDefault(err),
      });
      return failed("unknown", getErrorMessageOrDefault(err));
    } finally {
      if (job.controller === controller) {
        job.controller = undefined;
      }
    }
  }

  /** How far the send of a feedback has got, or null when none is running. */
  public progress(feedbackId: string): IFeedbackSendProgress | null {
    const job = this.#jobs.get(feedbackId);
    return job?.controller === undefined ? null : { sent: job.sent, total: job.total };
  }

  /** Stops the send of a feedback; the send resolves as canceled. */
  public cancel(feedbackId: string): void {
    this.#jobs.get(feedbackId)?.controller?.abort();
  }

  /** Stops and forgets a feedback that will not be sent again. */
  public discard(feedbackId: string): void {
    this.cancel(feedbackId);
    this.#jobs.delete(feedbackId);
  }

  #job(feedbackId: string): IJob {
    let job = this.#jobs.get(feedbackId);
    if (job === undefined) {
      job = { records: undefined, sent: 0, total: 0, controller: undefined };
      this.#jobs.set(feedbackId, job);
      for (const [id, kept] of this.#jobs) {
        if (this.#jobs.size <= MAX_KEPT_JOBS) break;
        // the oldest that is not sending right now
        if (kept.controller === undefined && id !== feedbackId) this.#jobs.delete(id);
      }
    }
    return job;
  }
}
