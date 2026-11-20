"use client";

import type { Level2 } from "@/lib/types";
import {
  resolveVizMode,
  VIZ_COLORS,
  type IndustryRow,
  type VizMode,
} from "@/lib/branchenViz";

type Props = {
  rows: IndustryRow[];
  byId: Map<string, Level2>;
  /** Force a mode for demo comparison; default = Steffen auto rules */
  forceMode?: VizMode | null;
  compact?: boolean;
};

export default function BranchenViz({
  rows,
  byId,
  forceMode = null,
  compact = false,
}: Props) {
  const filled = rows.filter((r) => r.bankable_id);
  const mode = forceMode ?? resolveVizMode(filled);
  const withPct = filled.filter((r) => r.pct !== "");

  let angle = 0;
  const stops = withPct.map((r, i) => {
    const pct = Number(r.pct) || 0;
    const start = angle;
    angle += (pct / 100) * 360;
    return `${VIZ_COLORS[i % VIZ_COLORS.length]} ${start}deg ${angle}deg`;
  });

  if (filled.length === 0) {
    return (
      <p className="text-[14px] text-[var(--muted)]">
        Noch keine Branche zugeordnet.
      </p>
    );
  }

  const size = compact ? "h-20 w-20" : "h-28 w-28";

  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--helper)]">
        Branchenzuordnung ·{" "}
        {mode === "bar"
          ? "Modus A · Balken"
          : mode === "donut"
            ? "Modus B · Donut"
            : "Modus C · Liste"}
      </p>

      {mode === "bar" && (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-semibold text-[var(--ink)]">
              {byId.get(filled[0].bankable_id)?.label_de}
            </p>
            <span className="text-[13px] text-[var(--muted)]">
              {filled[0].pct ? `${filled[0].pct}%` : "100%"}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--helper)]">
            {byId.get(filled[0].bankable_id)?.level1_label_de}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--grey-96)]">
            <div
              className="h-full rounded-full"
              style={{
                width: filled[0].pct ? `${Math.min(100, Number(filled[0].pct) || 0)}%` : "100%",
                background: "var(--blue-2)",
              }}
            />
          </div>
        </div>
      )}

      {mode === "donut" && (
        <div className="flex flex-wrap items-center gap-6">
          <div
            className={`${size} rounded-full`}
            style={{
              background: `conic-gradient(${stops.join(",")})`,
              mask: "radial-gradient(farthest-side, transparent 52%, #000 53%)",
              WebkitMask:
                "radial-gradient(farthest-side, transparent 52%, #000 53%)",
            }}
            aria-hidden
          />
          <ul className="space-y-2 text-[14px]">
            {filled.map((r, i) => (
              <li key={r.id} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: VIZ_COLORS[i % VIZ_COLORS.length] }}
                />
                <span className="font-medium text-[var(--ink)]">
                  {byId.get(r.bankable_id)?.label_de}
                </span>
                <span className="text-[var(--muted)]">{r.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === "list" && (
        <div>
          <ul className="space-y-2">
            {filled.map((r) => (
              <li
                key={r.id}
                className="rounded-xl bg-[var(--grey-96)] px-3 py-2.5 text-[14px]"
              >
                <span className="font-semibold text-[var(--ink)]">
                  {byId.get(r.bankable_id)?.label_de}
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--helper)]">
                  {byId.get(r.bankable_id)?.level1_label_de}
                  {r.pct ? ` · ${r.pct}%` : ""}
                </span>
              </li>
            ))}
          </ul>
          {filled.length > 1 && (
            <p className="mt-3 text-[12px] text-[var(--blue-2)]">
              Umsatzanteile ergänzen, um den Donut-Chart freizuschalten.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
