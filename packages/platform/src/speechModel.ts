type Preparation = (signal: AbortSignal) => Promise<boolean>;
let preparation: Preparation | undefined;
export function setSpeechModelPreparation(handler: Preparation) {
  preparation = handler;
  return () => { if (preparation === handler) preparation = undefined; };
}
export function prepareSpeechModel(signal: AbortSignal) {
  return signal.aborted ? Promise.resolve(false) : preparation?.(signal) ?? Promise.resolve(false);
}
