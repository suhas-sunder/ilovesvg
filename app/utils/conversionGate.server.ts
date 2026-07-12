import os from "node:os";
import type { MemoryDiagnosticJob } from "./memoryDiagnostics.server";

export type ReleaseFn = () => void;

export type ConversionGate = {
  acquireOrQueue: (
    diagnostics?: MemoryDiagnosticJob | null,
  ) => Promise<ReleaseFn>;
  getDiagnosticSnapshot: () => ConversionGateDiagnosticSnapshot;
  running: number;
  queued: number;
};

export type ConversionGateDiagnosticSnapshot = Readonly<{
  activeJobs: number;
  waitingJobs: number;
  capacity: number;
  queueCapacity: number;
}>;

type GateOptions = {
  maxRunning?: number;
  maxQueued?: number;
  estimatedJobMs?: number;
};

const GLOBAL_GATE_KEY = "__ilovesvg_shared_conversion_gate";

export async function getConversionGate(
  options: GateOptions = {},
): Promise<ConversionGate> {
  const globalState = globalThis as typeof globalThis & {
    [GLOBAL_GATE_KEY]?: ConversionGate;
  };

  if (globalState[GLOBAL_GATE_KEY]) {
    return globalState[GLOBAL_GATE_KEY];
  }

  const cpuCount = Math.max(1, os.cpus()?.length || 1);
  const maxRunning =
    options.maxRunning ?? Math.max(1, Math.min(2, cpuCount));
  const maxQueued = options.maxQueued ?? 8;
  const estimatedJobMs = options.estimatedJobMs ?? 3000;

  globalState[GLOBAL_GATE_KEY] = new SharedConversionGate(
    maxRunning,
    maxQueued,
    estimatedJobMs,
  );

  return globalState[GLOBAL_GATE_KEY];
}

class SharedConversionGate implements ConversionGate {
  private readonly maxRunning: number;
  private readonly maxQueued: number;
  private readonly estimatedJobMs: number;
  private readonly queue: Array<(release: ReleaseFn) => void> = [];

  running = 0;

  constructor(maxRunning: number, maxQueued: number, estimatedJobMs: number) {
    this.maxRunning = Math.max(1, Math.round(maxRunning));
    this.maxQueued = Math.max(0, Math.round(maxQueued));
    this.estimatedJobMs = Math.max(250, Math.round(estimatedJobMs));
  }

  get queued() {
    return this.queue.length;
  }

  getDiagnosticSnapshot(): ConversionGateDiagnosticSnapshot {
    return Object.freeze({
      activeJobs: this.running,
      waitingJobs: this.queue.length,
      capacity: this.maxRunning,
      queueCapacity: this.maxQueued,
    });
  }

  acquireOrQueue(diagnostics?: MemoryDiagnosticJob | null): Promise<ReleaseFn> {
    const waitStartedAt = diagnostics ? Date.now() : 0;
    diagnostics?.checkpoint("gate-wait-start", this.toDiagnosticMetadata());

    return new Promise((resolve, reject) => {
      const resolveAcquired = (release: ReleaseFn) => {
        diagnostics?.checkpoint("gate-acquired", {
          ...this.toDiagnosticMetadata(),
          gateWaitMs: Date.now() - waitStartedAt,
        });
        resolve(this.withDiagnosticRelease(release, diagnostics));
      };

      if (this.running < this.maxRunning) {
        this.running += 1;
        resolveAcquired(this.createRelease());
        return;
      }

      if (this.queue.length >= this.maxQueued) {
        const error = new Error("Server busy") as Error & {
          code?: string;
          retryAfterMs?: number;
        };
        error.code = "BUSY";
        error.retryAfterMs = this.estimateRetryMs();
        diagnostics?.checkpoint("conversion-error", {
          ...this.toDiagnosticMetadata(),
          errorClass: "busy",
          gateWaitMs: Date.now() - waitStartedAt,
        });
        reject(error);
        return;
      }

      this.queue.push(resolveAcquired);
    });
  }

  private withDiagnosticRelease(
    release: ReleaseFn,
    diagnostics?: MemoryDiagnosticJob | null,
  ): ReleaseFn {
    if (!diagnostics) return release;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      release();
      diagnostics.checkpoint("gate-released", this.toDiagnosticMetadata());
    };
  }

  private toDiagnosticMetadata() {
    return {
      gateActive: this.running,
      gateQueued: this.queue.length,
      gateCapacity: this.maxRunning,
      gateQueueCapacity: this.maxQueued,
    };
  }

  private createRelease(): ReleaseFn {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.running = Math.max(0, this.running - 1);

      const next = this.queue.shift();
      if (next) {
        this.running += 1;
        next(this.createRelease());
      }
    };
  }

  private estimateRetryMs() {
    const waves = Math.ceil((this.queue.length + 1) / this.maxRunning);
    return Math.min(15000, Math.max(1000, waves * this.estimatedJobMs));
  }
}
