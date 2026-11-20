"use client";

import { VIZ_COLORS, type IndustryRow } from "@/lib/branchenViz";
import type { Level2 } from "@/lib/types";

type Props = {
  rows: IndustryRow[];
  byId: Map<string, Level2>;
  /** Column layout: donut above, legend below (enterprise / Figma left stack) */
  stacked?: boolean;
};

/** Donut + legend — Figma Branchenzuordnung style */
export default function FigmaDonut({ rows, byId, stacked = true }: Props) {
  const filled = rows.filter((r) => r.bankable_id);
  if (!filled.length) {
    return (
      <p className="text-[14px] text-[var(--helper)]">
        Noch keine Branche zugeordnet.
      </p>
    );
  }

  const hasAllPct =
    filled.every((r) => r.pct !== "" && !Number.isNaN(Number(r.pct))) &&
    Math.abs(filled.reduce((s, r) => s + (Number(r.pct) || 0), 0) - 100) < 0.6;

  const slices = filled.map((r) => ({
    ...r,
    pct: hasAllPct
      ? Number(r.pct)
      : Math.round((100 / filled.length) * 10) / 10,
  }));

  const sumExceptLast = slices.slice(0, -1).reduce((s, r) => s + r.pct, 0);
  if (slices.length) {
    slices[slices.length - 1] = {
      ...slices[slices.length - 1],
      pct: Math.round((100 - sumExceptLast) * 10) / 10,
    };
  }

  let angle = 0;
  const stops = slices.map((r, i) => {
    const start = angle;
    angle += (r.pct / 100) * 360;
    return `${VIZ_COLORS[i % VIZ_COLORS.length]} ${start}deg ${angle}deg`;
  });

  return (
    <div
      className={
        stacked
          ? "flex flex-col items-center gap-5"
          : "flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8"
      }
    >
      <div
        className="relative h-[168px] w-[168px] shrink-0 rounded-full md:h-[184px] md:w-[184px]"
        style={{
          background: `conic-gradient(${stops.join(",")})`,
          mask: "radial-gradient(farthest-side, transparent 55%, #000 56%)",
          WebkitMask:
            "radial-gradient(farthest-side, transparent 55%, #000 56%)",
        }}
        aria-hidden
      />

      <ul
        className={
          stacked
            ? "grid w-full grid-cols-2 gap-x-4 gap-y-3"
            : "grid w-full grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2"
        }
      >
        {slices.map((r, i) => {
          const l2 = byId.get(r.bankable_id);
          return (
            <li key={r.id} className="flex items-start gap-2">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ background: VIZ_COLORS[i % VIZ_COLORS.length] }}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug text-[var(--ink)]">
                  {l2?.label_de ?? r.bankable_id}{" "}
                  <span className="font-semibold">{r.pct}%</span>
                </p>
                <p className="text-[11px] leading-snug text-[var(--helper)]">
                  {l2?.level1_label_de}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
