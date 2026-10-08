let leave: (() => boolean) | undefined;
let next: (() => void) | undefined;

export function bindNextApplication(handler: () => void) {
  next = handler;
  return () => { if (next === handler) next = undefined; };
}

export function nextApplicationExperience() { next?.(); }

/** Only the focused inline experience may consume SDK/back navigation. */
export function bindApplicationExperienceBack(handler: () => boolean) {
  leave = handler;
  return () => { if (leave === handler) leave = undefined; };
}

export function backFromApplicationExperience() {
  return leave?.() ?? false;
}
