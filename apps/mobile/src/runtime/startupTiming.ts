// Local JS milestones only: no network telemetry and no claim of a rendered frame.
const started = performance.now();
const milestones = new Set<string>();

export function markStartup(stage: string) {
  if (milestones.has(stage)) return;
  milestones.add(stage);
  console.log("startup", stage, "elapsedMs", Math.round(performance.now() - started));
}
