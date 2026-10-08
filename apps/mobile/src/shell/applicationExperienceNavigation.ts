let leave: (() => boolean) | undefined;

/** Only the focused inline experience may consume SDK/back navigation. */
export function bindApplicationExperienceBack(handler: () => boolean) {
  leave = handler;
  return () => { if (leave === handler) leave = undefined; };
}

export function backFromApplicationExperience() {
  return leave?.() ?? false;
}
