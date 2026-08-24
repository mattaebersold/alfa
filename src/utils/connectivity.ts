/** Long enough for a slow cell handover, short enough to not feel stuck. */
const PROBE_TIMEOUT_MS = 6000;

/**
 * Endpoints used to answer "does this device have a network at all".
 *
 * Three different operators, all of them tiny, cacheless, unauthenticated
 * responses designed for exactly this (captive-portal detection). Any one
 * answering is proof the phone has a route to the internet, so a single
 * provider having a bad day can't be mistaken for the device being cut off.
 *
 * Our own API is deliberately *not* in this list. An ORS outage, a bad deploy
 * or an expired certificate would otherwise be reported to the member as their
 * phone having no signal, which is both wrong and unactionable.
 */
const INTERNET_PROBES = [
  'https://connectivitycheck.gstatic.com/generate_204',
  'https://captive.apple.com/hotspot-detect.html',
  'https://cloudflare.com/cdn-cgi/trace',
];

async function ping(url: string, timeout = PROBE_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    // Any answer at all means packets are flowing. A captive portal's redirect
    // to its own login page is still a live network, and the member can act on
    // it — unlike genuine dead air, which is what this is looking for.
    return res.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Does the device have a working network connection?
 *
 * Resolves true the moment any probe answers rather than waiting for all of
 * them, so a good connection is confirmed at the speed of its fastest host and
 * only a genuinely dead one pays the full timeout.
 */
export async function probeInternet(): Promise<boolean> {
  return new Promise((resolve) => {
    let outstanding = INTERNET_PROBES.length;
    let settled = false;
    INTERNET_PROBES.forEach((url) => {
      ping(url).then((ok) => {
        if (settled) return;
        if (ok) {
          settled = true;
          resolve(true);
        } else if (--outstanding === 0) {
          settled = true;
          resolve(false);
        }
      });
    });
  });
}
