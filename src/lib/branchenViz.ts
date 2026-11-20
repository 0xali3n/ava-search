export type IndustryRow = {
  id: string;
  level1_id: string;
  bankable_id: string;
  pct: string;
};

/** Steffen mail §2 visualization modes */
export type VizMode = "bar" | "donut" | "list";

export function resolveVizMode(rows: IndustryRow[]): VizMode {
  const filled = rows.filter((r) => r.bankable_id);
  if (filled.length === 0) return "list";

  const withPct = filled.filter((r) => r.pct !== "" && !Number.isNaN(Number(r.pct)));
  const sum = withPct.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const allSharesKnown =
    withPct.length === filled.length && Math.abs(sum - 100) < 0.6;

  // A — one industry + revenue confirmed (or single treated as 100%)
  if (filled.length === 1 && (allSharesKnown || withPct.length === 0)) {
    return "bar";
  }

  // B — several + known shares summing to 100%
  if (filled.length >= 2 && allSharesKnown) {
    return "donut";
  }

  // C — several without (complete) shares
  return "list";
}

export const VIZ_COLORS = ["#00529b", "#3d7ab8", "#7aa7d4", "#18233d", "#6f9fc7"];

export type DemoProfilePayload = {
  companyName: string;
  rows: IndustryRow[];
};

export const DEMO_PROFILE_KEY = "bankable_demo_profile";
