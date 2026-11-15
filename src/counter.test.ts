import { describe, expect, it } from "vitest";
import { campaignQuery, countUrl, outsideReferrer, skipReason, type Browser, type Visit } from "./counter";

const visitor: Browser = { host: "screener.godvig.com", doNotTrack: false, automated: false, framed: false, prerendering: false };
const visit: Visit = { host: "screener.godvig.com", path: "/", title: "Market Screener", referrer: "", search: "", screenWidth: 1440 };
const sent = (v: Visit) => new URL(countUrl(v, "abcde")).searchParams;

describe("skipReason", () => {
  it("counts an ordinary visitor on the hosted demo", () => {
    expect(skipReason(visitor)).toBeNull();
  });

  it("counts nothing from a local install, a fork or a look-alike host", () => {
    for (const host of ["localhost:5173", "localhost:8787", "someone.github.io", "screener.godvig.com.example.org"]) {
      expect(skipReason({ ...visitor, host })).toBe("not the hosted demo");
    }
  });

  it("respects Do Not Track and skips robots, frames and prerenders", () => {
    expect(skipReason({ ...visitor, doNotTrack: true })).toMatch(/not to be tracked/);
    expect(skipReason({ ...visitor, automated: true })).toBe("automated browser");
    expect(skipReason({ ...visitor, framed: true })).toBe("inside a frame");
    expect(skipReason({ ...visitor, prerendering: true })).toBe("prerendering");
  });
});

describe("countUrl", () => {
  it("sends the site and path, the title, the screen width and a cache buster, and nothing else", () => {
    const q = sent(visit);
    expect(countUrl(visit, "abcde").startsWith("https://godvig.goatcounter.com/count?")).toBe(true);
    expect(q.get("p")).toBe("screener.godvig.com/");
    expect(q.get("t")).toBe("Market Screener");
    expect(q.get("s")).toBe("1440");
    expect([...q.keys()].sort()).toEqual(["p", "rnd", "s", "t"]);
  });

  it("passes on campaign parameters but no other part of the query string", () => {
    expect(campaignQuery("?x=1")).toBe("");
    expect(sent({ ...visit, search: "?utm_source=github&token=SECRET" }).get("q")).toBe("?utm_source=github");
    expect(countUrl({ ...visit, search: "?token=SECRET" }, "abcde")).not.toContain("SECRET");
  });

  it("includes the referrer only when there is one", () => {
    expect(sent(visit).has("r")).toBe(false);
    expect(sent({ ...visit, referrer: "https://adamenglund.eu/" }).get("r")).toBe("https://adamenglund.eu/");
  });
});

describe("outsideReferrer", () => {
  it("reports another site without its query string, and never the demo itself", () => {
    expect(outsideReferrer("https://github.com/godvig/market-screener?tab=readme", "screener.godvig.com")).toBe("https://github.com/godvig/market-screener");
    expect(outsideReferrer("https://screener.godvig.com/", "screener.godvig.com")).toBe("");
    expect(outsideReferrer("", "screener.godvig.com")).toBe("");
  });
});
