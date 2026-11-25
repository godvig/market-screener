// Anonymous visit counting for the hosted demo, with GoatCounter (https://www.goatcounter.com) through its
// documented /count endpoint.
//
// Only the demo at screener.godvig.com is counted: a local install or a fork never reports anywhere.
// No script is loaded from another server. One request per page load carries exactly five things:
//   the page (site + path, never anything after ? or #, so no list names or stock symbols), the page title,
//   the site the visitor came from, the screen width, and a campaign tag if the link carried one.
// No cookies are set and nothing is saved in the browser. Nothing is sent from automated browsers or when the
// browser asks not to be tracked.

const ENDPOINT = "https://screener.goatcounter.com/count";
/** Only the hosted demo is counted, so a local install or a fork never reports to this account. */
const COUNTED_HOST = "screener.godvig.com";
/** The only query parameters that are passed on: GoatCounter reads the campaign and its source from them. */
const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "ref"];

export interface Visit {
  host: string;
  /** Path of the view, starting with "/". */
  path: string;
  title: string;
  /** Empty when there is none or when it is this site itself. */
  referrer: string;
  /** location.search of the page; only the campaign parameters are used. */
  search: string;
  screenWidth: number;
}

export interface Browser {
  host: string;
  doNotTrack: boolean;
  automated: boolean;
  framed: boolean;
  prerendering: boolean;
}

/** Why this page view is not counted, or null when it is. */
export function skipReason(b: Browser): string | null {
  if (b.host !== COUNTED_HOST) return "not the hosted demo";
  if (b.doNotTrack) return "the browser asks not to be tracked";
  if (b.automated) return "automated browser";
  if (b.framed) return "inside a frame";
  if (b.prerendering) return "prerendering";
  return null;
}

/** The campaign parameters of a query string, as a new query string ("" when there are none). */
export function campaignQuery(search: string): string {
  const all = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const name of CAMPAIGN_PARAMS) {
    const value = all.get(name);
    if (value) kept.set(name, value);
  }
  const query = kept.toString();
  return query ? `?${query}` : "";
}

/** A referrer worth reporting: another site"s address, without its query string or fragment. */
export function outsideReferrer(referrer: string, host: string): string {
  try {
    const url = new URL(referrer);
    // Built from its parts instead of url.origin, which is "null" for app links such as android-app://org.telegram.messenger.
    return url.host === host ? "" : `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "";
  }
}

/** The request that counts one page view. `rnd` only stops browsers and proxies from caching it. */
export function countUrl(v: Visit, rnd: string): string {
  const params = new URLSearchParams({ p: `${v.host}${v.path}`, t: v.title });
  if (v.referrer) params.set("r", v.referrer);
  const campaign = campaignQuery(v.search);
  if (campaign) params.set("q", campaign);
  params.set("s", String(v.screenWidth));
  params.set("rnd", rnd);
  return `${ENDPOINT}?${params}`;
}

/** Count one load of the page. */
export function countView(path: string): void {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const reason = skipReason({
    host: location.host,
    doNotTrack: nav.doNotTrack === "1" || nav.globalPrivacyControl === true,
    automated: nav.webdriver === true,
    framed: window.self !== window.top,
    prerendering: (document as Document & { prerendering?: boolean }).prerendering === true,
  });
  if (reason) return;

  const url = countUrl(
    {
      host: location.host,
      path,
      title: document.title,
      referrer: outsideReferrer(document.referrer, location.host),
      search: location.search,
      screenWidth: window.screen.width,
    },
    Math.random().toString(36).slice(2, 7),
  );
  // sendBeacon survives the page closing; an image request is the fallback where it is unavailable or refused.
  if (!navigator.sendBeacon?.(url)) new Image().src = url;
}
