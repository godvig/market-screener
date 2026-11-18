// Deterministic fake data for offline development, demos and tests.
// Every symbol gets its own reproducible random walk.
import type { Candle, Fundamentals, HistoryRange, Quote, SearchResult } from "../../shared/types";
import { rangeToDays, type MarketProvider } from "./types";

const NAMES: Record<string, [string, string]> = {
  "VOLV-B.ST": ["Volvo AB ser. B", "SEK"],
  "ERIC-B.ST": ["Ericsson B", "SEK"],
  "INVE-B.ST": ["Investor AB ser. B", "SEK"],
  "ASML.AS": ["ASML Holding N.V.", "EUR"],
  AAPL: ["Apple Inc.", "USD"],
  MSFT: ["Microsoft Corporation", "USD"],
  NVDA: ["NVIDIA Corporation", "USD"],
  SPY: ["SPDR S&P 500 ETF Trust", "USD"],
};

/**
 * Rough price levels for the demo tickers, so a made-up price still looks
 * like the right order of magnitude. Each walk is scaled to end near its level.
 */
const PRICE_LEVEL: Record<string, number> = {
  "VOLV-B.ST": 280, "ERIC-B.ST": 85, "INVE-B.ST": 290, "ATCO-A.ST": 170, "SAND.ST": 230, "HM-B.ST": 160,
  "SHB-A.ST": 120, "SEB-A.ST": 160, "TELIA.ST": 32, "AZN.ST": 1450,
  AAPL: 230, MSFT: 450, NVDA: 140, GOOGL: 180, AMZN: 210, META: 600, SPY: 600, QQQ: 520, VT: 125,
  "ASML.AS": 700, "NOVO-B.CO": 500, "SAP.DE": 250, "NESN.SW": 85,
};

function seeded(seedText: string) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function walk(symbol: string): Candle[] {
  const rand = seeded(symbol);
  const drift = (rand() - 0.4) * 0.002;
  const vol = 0.01 + rand() * 0.02;
  let price = 20 + rand() * 400;
  const out: Candle[] = [];
  const end = new Date();
  const d = new Date(end.getTime() - rangeToDays["5y"] * 86_400_000);
  for (; d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const open = price;
    // Box-Muller normal shock
    const z = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    price = Math.max(1, price * Math.exp(drift + vol * z));
    const hi = Math.max(open, price) * (1 + rand() * vol * 0.5);
    const lo = Math.min(open, price) * (1 - rand() * vol * 0.5);
    out.push({ time: d.toISOString().slice(0, 10), open, high: hi, low: lo, close: price, volume: Math.round(1e6 * (0.5 + rand())) });
  }
  const level = PRICE_LEVEL[symbol];
  if (level == null || !out.length) return out;
  const k = (level * (0.85 + rand() * 0.3)) / out[out.length - 1].close;
  return out.map((c) => ({ ...c, open: c.open * k, high: c.high * k, low: c.low * k, close: c.close * k }));
}

/**
 * Valuation and dividend for a symbol, shared by the quote and the key
 * figures so they agree: payout is picked first and yield follows from it
 * (yield = payout / P/E), and a company either pays a dividend or doesn't.
 */
function profile(symbol: string) {
  const r = seeded(symbol + "profile");
  const pe = 8 + r() * 32;
  const paysDividend = r() > 0.25;
  const payoutRatio = paysDividend ? 20 + r() * 55 : 0;
  return { pe, paysDividend, payoutRatio, dividendYield: payoutRatio / pe };
}

export const mockProvider: MarketProvider = {
  name: "mock",
  batchQuotes: true,

  async getQuotes(symbols) {
    // Tickers ending in ".XX" act as unknown, to exercise error handling.
    return symbols.filter((s) => !s.endsWith(".XX")).map((symbol): Quote => {
      const h = walk(symbol);
      const last = h[h.length - 1];
      const prev = h[h.length - 2];
      const year = h.slice(-252).map((c) => c.close);
      const rand = seeded(symbol + "fundamentals");
      const [name, currency] = NAMES[symbol] ?? [`${symbol} (demo)`, "USD"];
      const { pe, dividendYield, payoutRatio } = profile(symbol);
      return {
        symbol,
        name,
        currency,
        exchange: "DEMO",
        price: last.close,
        change: last.close - prev.close,
        changePct: (last.close / prev.close - 1) * 100,
        volume: last.volume,
        marketCap: Math.round(1e9 * (5 + rand() * 2000)),
        pe,
        dividendYield,
        dividendPerShare: (last.close * dividendYield) / 100,
        payoutRatio,
        fiftyTwoWeekHigh: Math.max(...year),
        fiftyTwoWeekLow: Math.min(...year),
      };
    });
  },

  async getHistory(symbol: string, range: HistoryRange) {
    if (symbol.endsWith(".XX")) throw new Error(`${symbol} not found`);
    const cutoff = new Date(Date.now() - rangeToDays[range] * 86_400_000).toISOString().slice(0, 10);
    return walk(symbol).filter((c) => c.time >= cutoff);
  },

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const r = seeded(symbol + "keyfigures");
    const pick = (lo: number, hi: number, d = 1) => Number((lo + r() * (hi - lo)).toFixed(d));
    // A "quality" factor makes some companies consistently better, as in real
    // markets: strong margins tend to come with returns on capital and low debt.
    const q = r();
    const blend = (lo: number, hi: number, toward: number, d = 1) => Number((lo + (hi - lo) * (0.45 * r() + 0.55 * toward)).toFixed(d));
    const good = (lo: number, hi: number, d = 1) => blend(lo, hi, q, d);
    const low = (lo: number, hi: number, d = 1) => blend(lo, hi, 1 - q, d);
    const g = (lo: number, hi: number) => pick(lo + q * 6, hi + q * 6);
    const { pe, paysDividend } = profile(symbol);
    const price = walk(symbol).at(-1)?.close ?? 100;
    return {
      forwardPe: Number((pe * (0.75 + r() * 0.3)).toFixed(1)),
      peg: low(0.5, 3.5, 2),
      ps: pick(0.5, 12),
      pb: low(0.8, 15),
      evEbit: pick(6, 40),
      evEbitda: pick(4, 25),
      // Positive P/E means positive earnings, so EPS and margins follow from it.
      eps: Number((price / pe).toFixed(2)),
      roe: good(-5, 40),
      roa: good(-2, 20),
      profitMargin: good(2, 30),
      operatingMargin: good(4, 34),
      ebitdaMargin: good(0, 40),
      fcfMargin: good(-8, 28),
      fcfYield: pick(-2, 9, 2),
      roic: good(-3, 34),
      quickRatio: good(0.4, 2.5, 2),
      debtToEquity: low(0.1, 2.8, 2),
      equityRatio: good(15, 70),
      netDebtEbitda: low(-1, 4, 2),
      beta: pick(0.4, 1.9, 2),
      revenueGrowth: g(-10, 20),
      revenueCagr3y: g(-5, 15),
      revenueCagr5y: g(-3, 13),
      revenueCagr10y: g(-2, 12),
      earningsGrowth: g(-25, 30),
      earningsCagr3y: g(-10, 20),
      earningsCagr5y: g(-8, 18),
      earningsCagr10y: g(-5, 15),
      epsGrowth: g(-25, 30),
      epsCagr3y: g(-10, 20),
      epsCagr5y: g(-8, 18),
      epsCagr10y: g(-5, 15),
      ebitdaGrowth: g(-15, 25),
      ebitdaCagr3y: g(-8, 18),
      ebitdaCagr5y: g(-6, 16),
      ebitdaCagr10y: g(-4, 14),
      operatingIncomeGrowth: g(-20, 30),
      ...(paysDividend
        ? {
            dividendGrowth: g(-10, 15),
            dividendCagr3y: g(-5, 12),
            dividendCagr5y: g(-3, 11),
            dividendCagr10y: g(-2, 10),
            dividendYearsPaid: Math.round(pick(1, 30, 0)),
            dividendYearsNoCut: Math.round(pick(0, 15, 0)),
            dividendYearsRaised: Math.round(pick(0, 12, 0)),
          }
        : { dividendYield: 0, payoutRatio: 0 }),
    };
  },

  async search(query): Promise<SearchResult[]> {
    const q = query.toUpperCase();
    return Object.entries(NAMES)
      .filter(([s, [n]]) => s.includes(q) || n.toUpperCase().includes(q))
      .map(([symbol, [name]]) => ({ symbol, name, exchange: "DEMO" }));
  },
};
