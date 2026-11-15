let pending: Promise<unknown> = Promise.resolve();

/** Order scheduling mutations so two requests cannot reserve the same free room. */
export function scheduleWrite<T>(write: () => Promise<T>): Promise<T> {
  const result = pending.then(write);
  pending = result.catch(() => undefined);
  return result;
}
