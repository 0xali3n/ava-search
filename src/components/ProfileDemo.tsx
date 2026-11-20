"use client";

import BranchenViz from "@/components/BranchenViz";
import {
  DEMO_PROFILE_KEY,
  type DemoProfilePayload,
  type IndustryRow,
  type VizMode,
} from "@/lib/branchenViz";
import type { Catalog, Level2 } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const FALLBACK: DemoProfilePayload = {
  companyName: "Consortium Gastronomie GmbH",
  rows: [
    {
      id: "1",
      level1_id: "L1-21",
      bankable_id: "B21.03",
      pct: "55",
    },
    {
      id: "2",
      level1_id: "L1-21",
      bankable_id: "B21.04",
      pct: "45",
    },
  ],
};

export default function ProfileDemo({ catalog }: { catalog: Catalog }) {
  const [payload, setPayload] = useState<DemoProfilePayload>(FALLBACK);
  const [forceMode, setForceMode] = useState<VizMode | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DEMO_PROFILE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DemoProfilePayload;
      if (parsed?.companyName && Array.isArray(parsed.rows)) {
        setPayload(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, Level2>();
    catalog.industry_level2.forEach((r) => m.set(r.bankable_id, r));
    return m;
  }, [catalog]);

  const demoSets: { label: string; rows: IndustryRow[]; mode: VizMode }[] = [
    {
      label: "A · 1 Branche",
      mode: "bar",
      rows: [
        {
          id: "a",
          level1_id: "L1-21",
          bankable_id: "B21.03",
          pct: "100",
        },
      ],
    },
    {
      label: "B · Donut",
      mode: "donut",
      rows: [
        { id: "b1", level1_id: "L1-21", bankable_id: "B21.03", pct: "40" },
        { id: "b2", level1_id: "L1-21", bankable_id: "B21.04", pct: "35" },
        { id: "b3", level1_id: "L1-21", bankable_id: "B21.07", pct: "25" },
      ],
    },
    {
      label: "C · Liste",
      mode: "list",
      rows: [
        { id: "c1", level1_id: "L1-21", bankable_id: "B21.03", pct: "" },
        { id: "c2", level1_id: "L1-21", bankable_id: "B21.04", pct: "" },
      ],
    },
  ];

  return (
    <div className="reg-light min-h-svh">
      <div className="mx-auto max-w-[1200px] px-6 py-6 md:px-16">
        <header className="mb-8 flex items-center justify-between">
          <Image
            src="/brand/figma/logo.png"
            alt="BANKABLE"
            width={208}
            height={24}
            className="h-6 w-auto"
          />
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-[13px] font-semibold text-[var(--blue-2)]"
            >
              ← First Login Demo
            </Link>
            <span className="rounded-2xl px-3 py-2 text-[12px] font-semibold"
              style={{ background: "var(--logout)", color: "var(--ink)" }}
            >
              Demo · Profil-Kachel
            </span>
          </div>
        </header>

        <h1 className="text-[28px] font-semibold tracking-[0.04em] text-[var(--ink)]">
          {payload.companyName}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--muted)]">
          Allgemeine Unternehmensdaten — Branchenzuordnung (Steffen §2)
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <section
            className="rounded-2xl border border-[var(--line)] bg-white p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-[var(--ink)]">
                Allgemeine Unternehmensdaten
              </h2>
              <span className="text-[12px] text-[var(--helper)]">Bearbeiten</span>
            </div>
            <dl className="space-y-3 text-[14px]">
              <Row label="Firma" value={payload.companyName} />
              <Row label="Rechtsform" value="GmbH" />
              <Row label="Sitz" value="Frankfurt am Main" />
              <Row label="Website" value="—" />
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold text-[var(--ink)]">
                Branchenzuordnung
              </h2>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setForceMode(null)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    forceMode === null
                      ? "bg-[var(--ink)] text-white"
                      : "bg-[var(--grey-96)] text-[var(--ink)]"
                  }`}
                >
                  Auto
                </button>
                {demoSets.map((d) => (
                  <button
                    key={d.mode}
                    type="button"
                    onClick={() => {
                      setForceMode(d.mode);
                      setPayload((p) => ({ ...p, rows: d.rows }));
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      forceMode === d.mode
                        ? "bg-[var(--ink)] text-white"
                        : "bg-[var(--grey-96)] text-[var(--ink)]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <BranchenViz
              rows={payload.rows}
              byId={byId}
              forceMode={forceMode}
            />
          </section>
        </div>

        <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">
          Steffen: eine Branche → Balken 100%; mehrere mit Anteilen → Donut +
          Legende; mehrere ohne Anteile → Liste. Donut bleibt, weil er die
          textlastige Oberfläche auflockert.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 border-b border-[var(--line)] pb-2">
      <dt className="w-28 shrink-0 text-[var(--helper)]">{label}</dt>
      <dd className="font-medium text-[var(--ink)]">{value}</dd>
    </div>
  );
}
