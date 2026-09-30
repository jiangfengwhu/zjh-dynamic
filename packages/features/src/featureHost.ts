import type { ComponentType } from "react";

export type FeatureComponent = ComponentType<Record<string, never>>;

const features = new Map<string, FeatureComponent>();
const waiters = new Map<string, Array<(component: FeatureComponent) => void>>();

export function registerFeature(id: string, component: FeatureComponent) {
  console.log("feature registered", id);
  features.set(id, component);
  const pending = waiters.get(id) ?? [];
  waiters.delete(id);
  for (const resolve of pending) resolve(component);
}

export function peekFeature(id: string): FeatureComponent | undefined {
  return features.get(id);
}

export function waitForFeature(id: string): Promise<FeatureComponent> {
  const existing = features.get(id);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const pending = waiters.get(id) ?? [];
    pending.push(resolve);
    waiters.set(id, pending);
  });
}
