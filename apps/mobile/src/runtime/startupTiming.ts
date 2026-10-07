// Local JS milestones only: no network telemetry and no claim of a rendered frame.
const started = performance.now();
const milestones = new Set<string>();
const workSamples = new Map<string, number>();

export function markStartup(stage: string) {
  if (milestones.has(stage)) return;
  milestones.add(stage);
  console.log("startup", stage, "elapsedMs", Math.round(performance.now() - started));
}

/** Bounded local cold-start samples; never sends content or network telemetry. */
export function measureStartupWork<T>(stage: string, work: () => T): T {
  const samples = workSamples.get(stage) ?? 0;
  if (samples >= 4 || performance.now() - started > 10000) return work();
  const begin = performance.now();
  try { return work(); }
  finally {
    workSamples.set(stage, samples + 1);
    console.log("startup-work", stage, "durationMs", Math.round((performance.now() - begin) * 10) / 10);
  }
}
