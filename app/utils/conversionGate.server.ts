import os from "node:os";

export type ReleaseFn = () => void;

export type ConversionGate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

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

  acquireOrQueue(): Promise<ReleaseFn> {
    return new Promise((resolve, reject) => {
      if (this.running < this.maxRunning) {
        this.running += 1;
        resolve(this.createRelease());
        return;
      }

      if (this.queue.length >= this.maxQueued) {
        const error = new Error("Server busy") as Error & {
          code?: string;
          retryAfterMs?: number;
        };
        error.code = "BUSY";
        error.retryAfterMs = this.estimateRetryMs();
        reject(error);
        return;
      }

      this.queue.push((release) => resolve(release));
    });
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
