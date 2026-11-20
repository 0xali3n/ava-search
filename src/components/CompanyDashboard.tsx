"use client";

import FigmaDonut from "@/components/FigmaDonut";
import SearchableSelect from "@/components/registration/SearchableSelect";
import type { IndustryRow } from "@/lib/branchenViz";
import type { Catalog, Level2 } from "@/lib/types";
import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";

/**
 * Final Task 2.2 layout (no redundant side block):
 * LEFT  = Allgemeine + Branchenzuordnung (donut)
 * RIGHT = Rechtliches
 * Below = short Umfeld
 */
const MOCK = {
  name: "ABC Antriebstechnik GmbH",
  updated: "zuletzt aktualisiert am 19.11.2026",
  firma: "ABC Antriebstechnik GmbH",
  anschrift: "Musterstraße 12, 60311 Frankfurt am Main",
  website: "https://www.abc-antrieb.example",
  mitarbeiter: "128",
  beteiligungen: "ABC Holding AG, Zürich, 100,00 %",
  gegenstand: "Antriebstechnik, 100%",
  produkte:
    "Elektromotoren · Steuerungen · Ersatzteile\nB2B-Vertrieb · Produktentwicklung",
  groessenklasse: "Mittelgroße Kapitalgesellschaft",
  rechtsform: "Gesellschaft mit beschränkter Haftung",
  handelsregister: "Frankfurt am Main · HRB 12345",
  gruendung: "2014",
  gf: "Beispiel, Anna, Frankfurt, *12.03.1985",
  prokura: "Muster, Chris, Mainz",
  vertretung:
    "Ist nur ein Geschäftsführer bestellt, so vertritt er die Gesellschaft allein.",
  gesellschafter: "ABC Holding AG, Zürich — 100,00 %",
  // Lean finance block — few KPIs next to donut (no clutter)
  umsatz: "42,5 Mio. €",
  bilanzsumme: "6,89 Mio. €",
  eigenkapital: "2,41 Mio. €",
  ekQuote: "35 %",
  jahresueberschuss: "0,48 Mio. €",
  geschaeftsjahr: "2024",
  umfeld:
    "Wettbewerber: regionale Maschinenbau-Zulieferer.\nKunden: OEM & Instandhalter DACH.\nLieferanten: Komponentenhersteller EU.",
};

const TABS_TOP = [
  "Übersicht",
  "Unternehmensprofil",
  "Interne Berechtigungen",
  "Externe Datenfreigabe",
];

const TABS_SUB = [
  "Unternehmens- & Marktumfeld",
  "GuV & Bilanz",
  "Finanzanalyse & Cashflow",
  "Planung",
  "Dokumente",
];

type Props = {
  catalog: Catalog;
  initialRows: IndustryRow[];
  onBack: () => void;
};

export default function CompanyDashboard({
  catalog,
  initialRows,
  onBack,
}: Props) {
  const [rows, setRows] = useState<IndustryRow[]>(() =>
    initialRows.length
      ? initialRows.map((r, i) => ({
          ...r,
          pct:
            r.pct ||
            String(
              i === initialRows.length - 1
                ? 100 -
                    Math.floor(100 / initialRows.length) *
                      (initialRows.length - 1)
                : Math.floor(100 / initialRows.length)
            ),
        }))
      : [
          {
            id: "m1",
            level1_id: "L1-01",
            bankable_id: "B01.06",
            pct: "55",
          },
          {
            id: "m2",
            level1_id: "L1-01",
            bankable_id: "B01.01",
            pct: "25",
          },
          {
            id: "m3",
            level1_id: "L1-11",
            bankable_id: "B11.12",
            pct: "20",
          },
        ]
  );
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [manualL1, setManualL1] = useState("");
  const [manualL2, setManualL2] = useState("");

  const byId = useMemo(() => {
    const m = new Map<string, Level2>();
    catalog.industry_level2.forEach((r) => m.set(r.bankable_id, r));
    return m;
  }, [catalog]);

  const safeRows = useMemo(
    () => rows.filter((r) => byId.has(r.bankable_id)),
    [rows, byId]
  );

  const l1Options = catalog.industry_level1.map((l1) => ({
    value: l1.id,
    label: l1.label_de,
  }));
  const l2Options = catalog.industry_level2
    .filter((x) => !manualL1 || x.level1_id === manualL1)
    .map((l2) => ({
      value: l2.bankable_id,
      label: l2.label_de,
      hint: manualL1 ? undefined : l2.level1_label_de,
    }));

  const pctSum = safeRows.reduce((s, r) => s + (Number(r.pct) || 0), 0);

  function setPct(id: string, pct: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, pct: pct.replace(/[^\d.]/g, "") } : r
      )
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addIndustry() {
    if (!manualL2 || !byId.has(manualL2)) return;
    const row = byId.get(manualL2)!;
    setRows((prev) => {
      if (prev.some((r) => r.bankable_id === manualL2)) return prev;
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          level1_id: row.level1_id,
          bankable_id: manualL2,
          pct: "",
        },
      ];
    });
    setManualL1("");
    setManualL2("");
    setShowAdd(false);
  }

  return (
    <div className="min-h-svh bg-[#f3f4f6]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-[1204px] items-center justify-between gap-4 px-5 py-3 md:px-8">
          <Image
            src="/brand/figma/logo.png"
            alt="BANKABLE"
            width={180}
            height={22}
            className="h-5 w-auto"
            priority
          />
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {TABS_TOP.map((t, i) => (
              <span
                key={t}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  i === 1
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--ink)]"
                }`}
              >
                {t}
              </span>
            ))}
          </nav>
          <button
            type="button"
            onClick={onBack}
            className="text-[13px] font-semibold text-[var(--blue-2)]"
          >
            ← Zurück
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1204px] px-5 py-6 md:px-8 md:py-8">
        <div className="mb-4">
          <h1 className="text-[28px] font-semibold leading-tight text-[var(--ink)] md:text-[32px]">
            {MOCK.name}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--helper)]">{MOCK.updated}</p>
        </div>

        <div className="mb-5 overflow-x-auto rounded-lg bg-[#e8eaed] p-1">
          <div className="flex min-w-max gap-0.5">
            {TABS_SUB.map((t, i) => (
              <span
                key={t}
                className={`rounded-md px-3 py-2 text-[12px] font-semibold ${
                  i === 0
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--muted)]"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/*
          Row 1: Allgemeine | Rechtliches  (paired heights)
          Row 2: Branchen   | Finanzübersicht (paired heights — no gap)
        */}
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card title="Allgemeine Unternehmensdaten">
            <Field label="Firma" value={MOCK.firma} />
            <Field label="Anschrift" value={MOCK.anschrift} />
            <Field label="Website" value={MOCK.website} link />
            <Field label="Mitarbeiter" value={MOCK.mitarbeiter} />
            <Field label="Beteiligungen" value={MOCK.beteiligungen} />
            <Field
              label="Gegenstand des Unternehmens"
              value={MOCK.gegenstand}
            />
            <Field
              label="Produkte & Dienstleistungen"
              value={MOCK.produkte}
            />
          </Card>

          <Card title="Rechtliches & Governance">
            <Field label="Größenklasse" value={MOCK.groessenklasse} />
            <Field label="Rechtsform" value={MOCK.rechtsform} />
            <Field label="Handelsregister" value={MOCK.handelsregister} />
            <Field label="Gründungsjahr" value={MOCK.gruendung} />
            <Field label="Geschäftsführung" value={MOCK.gf} />
            <Field label="Prokura" value={MOCK.prokura} />
            <Field label="Vertretungsregelung" value={MOCK.vertretung} />
            <Field label="Gesellschafter" value={MOCK.gesellschafter} />
          </Card>

          <section className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--ink)]">
                  Branchenzuordnung
                </h2>
                <p className="text-[12px] text-[var(--helper)]">
                  Detailbranchen · Umsatzanteile
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing((e) => !e)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  editing
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--blue-2)] hover:bg-[var(--progress-track)]"
                }`}
              >
                {editing ? "Fertig" : "Bearbeiten"}
              </button>
            </div>

            <div className="flex-1">
              <FigmaDonut rows={safeRows} byId={byId} stacked />
            </div>

            {editing && (
              <div className="mt-5 space-y-2 border-t border-[var(--line)] pt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-[var(--helper)]">
                    Hinzufügen · % · entfernen
                  </p>
                  {safeRows.some((r) => r.pct !== "") && (
                    <p
                      className={`text-[12px] font-semibold ${
                        Math.abs(pctSum - 100) < 0.6
                          ? "text-emerald-700"
                          : "text-[var(--ink)]"
                      }`}
                    >
                      Summe {pctSum}%
                    </p>
                  )}
                </div>
                <ul className="space-y-2">
                  {safeRows.map((r) => {
                    const l2 = byId.get(r.bankable_id);
                    if (!l2) return null;
                    return (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f3f4f6] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[var(--ink)]">
                            {l2.label_de}
                          </p>
                          <p className="text-[11px] text-[var(--helper)]">
                            {l2.level1_label_de} · {l2.bankable_id}
                          </p>
                        </div>
                        <input
                          value={r.pct}
                          onChange={(e) => setPct(r.id, e.target.value)}
                          placeholder="%"
                          inputMode="decimal"
                          className="h-9 w-16 rounded-md border border-[var(--helper)] bg-white px-2 text-center text-[13px] outline-none focus:border-[var(--blue-2)]"
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(r.id)}
                          className="h-9 rounded-full border border-[var(--helper)] px-3 text-[12px] font-semibold hover:border-red-400 hover:text-red-700"
                        >
                          Entfernen
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!showAdd ? (
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="mt-2 inline-flex h-9 items-center gap-2 rounded-[30px] border border-[var(--ink)] bg-white px-4 text-[13px] font-semibold"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/figma/circle-plus.svg"
                      alt=""
                      width={16}
                      height={16}
                    />
                    Branche hinzufügen
                  </button>
                ) : (
                  <div className="mt-2 space-y-2 rounded-xl border border-[var(--line)] bg-[#f3f4f6] p-3">
                    <SearchableSelect
                      value={manualL1}
                      options={l1Options}
                      placeholder="Branche"
                      onChange={(v) => {
                        setManualL1(v);
                        setManualL2("");
                      }}
                    />
                    <SearchableSelect
                      value={manualL2}
                      options={l2Options}
                      placeholder="Detailbranche"
                      onChange={(v) => {
                        setManualL2(v);
                        const row = byId.get(v);
                        if (row) setManualL1(row.level1_id);
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={addIndustry}
                        disabled={!manualL2}
                        className="h-9 rounded-[30px] px-4 text-[13px] font-semibold text-white disabled:opacity-40"
                        style={{ background: "var(--blue-2)" }}
                      >
                        Übernehmen
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdd(false);
                          setManualL1("");
                          setManualL2("");
                        }}
                        className="h-9 rounded-[30px] border border-[var(--helper)] px-4 text-[13px] font-semibold"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Same row as Branchen — lean KPIs, equal height, no gap */}
          <section className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm md:p-6">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">
                Finanzübersicht
              </h2>
              <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-semibold text-[var(--helper)]">
                GJ {MOCK.geschaeftsjahr}
              </span>
            </div>
            <p className="mb-4 text-[12px] text-[var(--helper)]">
              Bilanz & Ergebnis — Kurzüberblick
            </p>
            <div className="grid flex-1 grid-cols-2 content-stretch gap-3">
              <MiniStat label="Umsatz" value={MOCK.umsatz} grow />
              <MiniStat label="Bilanzsumme" value={MOCK.bilanzsumme} grow />
              <MiniStat label="Eigenkapital" value={MOCK.eigenkapital} grow />
              <MiniStat label="EK-Quote" value={MOCK.ekQuote} grow />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-[#eceff3] px-4 py-3.5">
              <span className="text-[12px] font-semibold text-[var(--helper)]">
                Jahresüberschuss
              </span>
              <span className="text-[16px] font-semibold text-[var(--blue-2)]">
                {MOCK.jahresueberschuss}
              </span>
            </div>
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-2 text-[16px] font-semibold text-[var(--ink)]">
            Unternehmensumfeld
          </h2>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-[var(--ink)]">
            {MOCK.umfeld}
          </p>
        </section>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">{title}</h2>
        <span className="text-[12px] font-semibold text-[var(--blue-2)]">
          Bearbeiten
        </span>
      </div>
      <dl className="flex-1">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: boolean;
}) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-[#e8eaed] py-3 last:border-b-0 md:grid-cols-[168px_1fr]">
      <dt className="text-[13px] leading-snug text-[var(--helper)]">{label}</dt>
      <dd
        className={`whitespace-pre-line text-[13px] font-medium leading-snug ${
          link ? "text-[var(--blue-2)]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function MiniStat({
  label,
  value,
  grow,
}: {
  label: string;
  value: string;
  grow?: boolean;
}) {
  return (
    <div
      className={`flex flex-col justify-center rounded-xl bg-[#eef0f2] px-3 py-3 ${
        grow ? "min-h-[88px]" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--helper)]">
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}
