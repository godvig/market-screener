import { useSyncExternalStore } from "react";
import { METRIC_BY_KEY, type MetricKey } from "../shared/metrics";

/**
 * The interface is in English, but key figures can be shown under their
 * Swedish names (Direktavkastning, Utdelningsandel …), the ones Swedish
 * investors know from Börsdata and annual reports. Per browser, like the theme.
 */
export type MetricLang = "en" | "sv";
const KEY = "market-screener.metricNames";
const listeners = new Set<() => void>();

function read(): MetricLang {
  try {
    return localStorage.getItem(KEY) === "sv" ? "sv" : "en";
  } catch {
    return "en";
  }
}
let lang: MetricLang = read();

export function setMetricLang(next: MetricLang) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
  listeners.forEach((l) => l());
}

/** Re-renders the caller when the language changes. */
export function useMetricLang(): MetricLang {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => lang,
  );
}

/** A key figure's name in the chosen language; `english` is what to show otherwise. */
export function metricName(key: string, english?: string): string {
  const def = METRIC_BY_KEY.get(key as MetricKey);
  if (lang === "sv" && def?.sv) return def.sv;
  return english ?? def?.label ?? key;
}

/** A scorecard criterion's name: its own label in English, the key figure's Swedish name in Swedish. */
export const criterionName = (c: { metric: string; label: string }): string => metricName(c.metric, c.label);

/** A table column's name: translated when the column is a key figure. */
export const columnName = (c: { id: string; label: string }): string => (METRIC_BY_KEY.has(c.id as MetricKey) ? metricName(c.id, c.label) : c.label);
