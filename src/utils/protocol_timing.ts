import { Utils } from "@mmote/niimbluelib";

const BACKGROUND_SHORT_DELAY_LIMIT_MS = 50;

let installed = false;
let lastShortDelayCompletedAt = Number.NEGATIVE_INFINITY;

/**
 * Browser window timers are throttled when the page is hidden. niimbluelib uses
 * Utils.sleep() for the short packet spacing required by the printer transport,
 * so a normal 10 ms delay can become roughly 1 second after switching tabs.
 *
 * Hidden tabs only need to preserve the minimum spacing between transport
 * writes. Time already spent waiting for the previous printer response counts
 * toward that spacing, so we wait only for the remaining few milliseconds.
 */
const completeShortDelayWithoutTimer = (delayMs: number): Promise<undefined> => {
  const now = performance.now();
  const elapsedSincePreviousDelay = now - lastShortDelayCompletedAt;
  const remainingMs = Math.max(0, delayMs - elapsedSincePreviousDelay);

  if (remainingMs > 0) {
    const deadline = now + remainingMs;

    while (performance.now() < deadline) {
      // Deliberately avoid setTimeout/setInterval here. The wait is capped to a
      // short protocol delay, and normally only a fraction of it remains after
      // the previous packet/response round trip.
    }
  }

  lastShortDelayCompletedAt = performance.now();
  return Promise.resolve(undefined);
};

/**
 * Keep niimbluelib's transport packet pacing stable while the tab is hidden.
 *
 * Foreground behavior is unchanged. Longer waits (status/retry delays) also
 * keep using the normal browser timer because stretching those waits is safe;
 * only short transport pacing is timing-critical for print/firmware transfers.
 */
export const installBackgroundSafeProtocolTiming = (): void => {
  if (installed) {
    return;
  }

  installed = true;

  const browserSleep = Utils.sleep.bind(Utils);

  Utils.sleep = async (ms: number): Promise<undefined> => {
    const isShortProtocolDelay = ms > 0 && ms <= BACKGROUND_SHORT_DELAY_LIMIT_MS;

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden" &&
      isShortProtocolDelay
    ) {
      return completeShortDelayWithoutTimer(ms);
    }

    const result = await browserSleep(ms);

    if (isShortProtocolDelay) {
      // Utils.sleep() is called immediately before transport writes, so the
      // completion time is a close lower bound for the previous packet send.
      lastShortDelayCompletedAt = performance.now();
    }

    return result;
  };
};
