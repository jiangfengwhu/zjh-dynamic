import type { ComponentType } from "react";

export type FeatureComponent = ComponentType<Record<string, never>>;

const features = new Map<string, FeatureComponent>();

export function registerFeature(id: string, component: FeatureComponent) {
  console.log("feature registered", id);
  features.set(id, component);
}

export function peekFeature(id: string): FeatureComponent | undefined {
  return features.get(id);
}
