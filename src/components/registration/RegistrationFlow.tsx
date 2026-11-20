"use client";

import BranchenViz from "@/components/BranchenViz";
import SearchableSelect from "@/components/registration/SearchableSelect";
import { DEMO_PROFILE_KEY } from "@/lib/branchenViz";
import type { Catalog, DemoCompany, Level2 } from "@/lib/types";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = { catalog: Catalog; companies: DemoCompany[] };
type Step = "welcome" | "processing" | "branche" | "success";

type Row = {
  id: string;
  level1_id: string;
  bankable_id: string;
  pct: string;
  fromSuggestion?: boolean;
};

const USER = "BENJAMIN KLEIN";

const DEFAULT_SUGGESTIONS = [
  { pill: "Sonstige Verpflegungsdienstleistungen", bankable_id: "B21.04" },
  { pill: "Event-Catering", bankable_id: "B21.07" },
  { pill: "Restaurants und Gaststätten", bankable_id: "B21.03" },
];

export default function RegistrationFlow({ catalog, companies }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [company, setCompany] = useState<DemoCompany | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([
    { id: "seed", level1_id: "", bankable_id: "", pct: "" },
  ]);

  const byId = useMemo(() => {
    const m = new Map<string, Level2>();
    catalog.industry_level2.forEach((r) => m.set(r.bankable_id, r));
    return m;
  }, [catalog]);

  const suggestions = useMemo(() => {
    if (!company) return DEFAULT_SUGGESTIONS;

    const fromList = (ids: string[]) =>
      ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((l2) => ({ pill: l2!.label_de, bankable_id: l2!.bankable_id }));

    if (company.suggest_bankable_ids?.length) {
      const mapped = fromList(company.suggest_bankable_ids);
      if (mapped.length) return mapped;
    }

    if (company.bankable_id && byId.has(company.bankable_id)) {
      const primary = byId.get(company.bankable_id)!;
      const siblings = catalog.industry_level2
        .filter(
          (x) =>
            x.level1_id === primary.level1_id &&
            x.bankable_id !== primary.bankable_id
        )
        .slice(0, 2);
      return [
        { pill: primary.label_de, bankable_id: primary.bankable_id },
        ...siblings.map((s) => ({
          pill: s.label_de,
          bankable_id: s.bankable_id,
        })),
      ];
    }
    if (/gastronomie|restaurant|catering/i.test(company.name)) {
      return DEFAULT_SUGGESTIONS;
    }
    return [];
  }, [company, byId, catalog]);

  function seedBrancheFromCompany(c: DemoCompany | null) {
    if (!c) {
      setAccepted([]);
      setRows([{ id: crypto.randomUUID(), level1_id: "", bankable_id: "", pct: "" }]);
      return;
    }

    const suggestIds =
      c.suggest_bankable_ids?.filter((id) => byId.has(id)) ??
      (c.bankable_id && byId.has(c.bankable_id) ? [c.bankable_id] : []);

    const preselect =
      c.preselect_bankable_ids?.filter((id) => byId.has(id)) ??
      suggestIds.slice(0, Math.min(2, suggestIds.length));

    const shares = c.demo_shares ?? {};

    setAccepted(preselect);
    if (preselect.length === 0) {
      setRows([{ id: crypto.randomUUID(), level1_id: "", bankable_id: "", pct: "" }]);
      return;
    }

    setRows(
      preselect.map((id) => {
        const item = byId.get(id)!;
        return {
          id: crypto.randomUUID(),
          level1_id: item.level1_id,
          bankable_id: item.bankable_id,
          pct: shares[id] ?? "",
          fromSuggestion: true,
        };
      })
    );
  }

  useEffect(() => {
    if (step !== "processing") return;
    const t = setTimeout(() => {
      seedBrancheFromCompany(company);
      setStep("branche");
    }, 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when processing starts
  }, [step]);

  function goStep(n: number) {
    if (n === 1) setStep("welcome");
    else if (n === 2) {
      seedBrancheFromCompany(company);
      setStep("branche");
    } else setStep("success");
  }

  function toggleSuggestion(bankable_id: string) {
    const item = byId.get(bankable_id);
    if (!item) return;

    if (accepted.includes(bankable_id) || rows.some((r) => r.bankable_id === bankable_id)) {
      setAccepted((a) => a.filter((x) => x !== bankable_id));
      setRows((r) => {
        const next = r.filter((x) => x.bankable_id !== bankable_id);
        return next.length
          ? next
          : [{ id: crypto.randomUUID(), level1_id: "", bankable_id: "", pct: "" }];
      });
      return;
    }

    setAccepted((a) => [...a, bankable_id]);
    setRows((r) => {
      const empty = r.find((x) => !x.bankable_id && !x.level1_id);
      if (empty) {
        return r.map((x) =>
          x.id === empty.id
            ? {
                ...x,
                level1_id: item.level1_id,
                bankable_id: item.bankable_id,
                fromSuggestion: true,
              }
            : x
        );
      }
      return [
        ...r,
        {
          id: crypto.randomUUID(),
          level1_id: item.level1_id,
          bankable_id: item.bankable_id,
          pct: "",
          fromSuggestion: true,
        },
      ];
    });
  }

  function addRow() {
    setRows((r) => [
      ...r,
      { id: crypto.randomUUID(), level1_id: "", bankable_id: "", pct: "" },
    ]);
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // L1 change clears L2 (linked fields)
        if (patch.level1_id !== undefined && patch.level1_id !== r.level1_id) {
          next.bankable_id = "";
        }
        // L2 pick auto-fills L1 from catalog
        if (patch.bankable_id) {
          const item = byId.get(patch.bankable_id);
          if (item) next.level1_id = item.level1_id;
        }
        return next;
      })
    );
  }

  function removeRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (row?.bankable_id) setAccepted((a) => a.filter((x) => x !== row.bankable_id));
    setRows((rows) => {
      const next = rows.filter((r) => r.id !== id);
      return next.length
        ? next
        : [{ id: crypto.randomUUID(), level1_id: "", bankable_id: "", pct: "" }];
    });
  }

  const activeRows = rows.filter((r) => r.bankable_id || r.level1_id || r.pct);
  const pctSum = activeRows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const canContinue =
    activeRows.length > 0 &&
    activeRows.every((r) => r.bankable_id) &&
    (activeRows.every((r) => r.pct === "") || Math.abs(pctSum - 100) < 0.6);

  const stepIndex =
    step === "welcome" ? 1 : step === "processing" || step === "branche" ? 2 : 3;

  const companyName = company?.name ?? "Unternehmen auswählen";

  return (
    <div className={`reg-light ${step === "welcome" ? "h-svh overflow-hidden" : ""}`}>
      <div
        className={`mx-auto flex w-full max-w-[1440px] flex-col px-6 md:px-[118px] ${
          step === "welcome" ? "h-full pb-4 pt-1" : "pb-16 pt-2"
        }`}
      >
        <Header step={stepIndex} onGo={goStep} compact={step === "welcome"} />

        {step === "welcome" && (
          <Welcome
            companies={companies}
            company={company}
            onSelect={(c) => setCompany(c)}
            onNext={() => {
              if (!company) return;
              setStep("processing");
            }}
          />
        )}
        {step === "processing" && <Processing companyName={companyName} />}
        {step === "branche" && (
          <Branche
            catalog={catalog}
            suggestions={suggestions}
            accepted={accepted}
            rows={rows}
            pctSum={pctSum}
            canContinue={canContinue}
            onToggle={toggleSuggestion}
            onAdd={addRow}
            onUpdate={updateRow}
            onRemove={removeRow}
            onNext={() => setStep("success")}
          />
        )}
        {step === "success" && (
          <Success
            companyName={companyName}
            rows={rows}
            byId={byId}
            onBack={() => setStep("branche")}
            onStart={() => {
              try {
                sessionStorage.setItem(
                  DEMO_PROFILE_KEY,
                  JSON.stringify({
                    companyName,
                    rows: rows.map(({ id, level1_id, bankable_id, pct }) => ({
                      id,
                      level1_id,
                      bankable_id,
                      pct,
                    })),
                  })
                );
              } catch {
                /* ignore */
              }
              window.location.href = "/profile";
            }}
          />
        )}
      </div>
    </div>
  );
}

function Header({
  step,
  onGo,
  compact = false,
}: {
  step: number;
  onGo: (n: number) => void;
  compact?: boolean;
}) {
  const items = [
    { n: 1, label: "Willkommen" },
    { n: 2, label: "Informationen aufbereiten" },
    { n: 3, label: "Profil entdecken" },
  ];
  const fill = step === 1 ? "w-1/4" : step === 2 ? "w-1/2" : "w-3/4";

  return (
    <header
      className={`flex shrink-0 flex-col ${compact ? "mb-4 gap-3" : "mb-8 gap-8"}`}
    >
      <div
        className={`flex items-center justify-between ${compact ? "py-2" : "py-6"}`}
      >
        <Image
          src="/brand/figma/logo.png"
          alt="BANKABLE"
          width={208}
          height={24}
          className="h-6 w-auto"
          priority
        />
        <div className="flex items-center gap-3">
          <span className="hidden text-[12px] tracking-[0.05em] text-[var(--helper)] sm:inline">
            Demo · Steps klickbar
          </span>
          <button
            type="button"
            className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[15px] font-semibold tracking-[0.05em]"
            style={{ background: "var(--logout)", color: "var(--ink)" }}
          >
            Abmelden
            <Image src="/brand/figma/x.svg" alt="" width={24} height={24} />
          </button>
        </div>
      </div>

      <div className={`flex flex-col ${compact ? "gap-3" : "gap-6"}`}>
        <div
          className={`w-full overflow-hidden rounded-full ${compact ? "h-2.5" : "h-4"}`}
          style={{ background: "var(--progress-track)" }}
        >
          <div className={`h-full ${fill}`} style={{ background: "var(--ink)" }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          {items.map((item) => {
            const done = item.n < step;
            const active = item.n === step;
            return (
              <button
                key={item.n}
                type="button"
                onClick={() => onGo(item.n)}
                className="flex items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:opacity-80"
                title={`Demo: zu Schritt ${item.n}`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                  style={{
                    background: done || active ? "var(--ink)" : "var(--progress-track)",
                    color: done || active ? "var(--progress-track)" : "var(--ink)",
                  }}
                >
                  {item.n}
                </span>
                <span className="hidden text-[15px] font-semibold tracking-[0.05em] text-[var(--ink)] md:inline">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

function Welcome({
  companies,
  company,
  onSelect,
  onNext,
}: {
  companies: DemoCompany[];
  company: DemoCompany | null;
  onSelect: (c: DemoCompany | null) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const matches =
    q.length < 2
      ? []
      : companies
          .filter((c) => c.name.toLowerCase().includes(q))
          .slice(0, 6);

  const selectedOk =
    !!company && query.trim().toLowerCase() === company.name.toLowerCase();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
      <div className="flex w-full max-w-[640px] flex-col gap-3.5">
        <p className="text-[13px] font-semibold tracking-[0.05em] text-[var(--blue-2)]">
          WILLKOMMEN, {USER}
        </p>
        <h1 className="text-[32px] font-semibold leading-[1.2] tracking-[0.05em] text-[var(--ink)] xl:text-[36px]">
          Weniger suchen.
          <br />
          Mehr Überblick.
        </h1>
        <p className="text-[17px] leading-[1.3] tracking-[0.05em] text-[var(--ink)]">
          Entdecken Sie BANKABLE anhand öffentlicher Unternehmensinformationen.
        </p>

        <div
          ref={wrapRef}
          className="relative flex flex-col gap-1.5 rounded-xl p-4"
          style={{ background: "var(--grey-96)" }}
        >
          <p className="text-[13px] tracking-[0.05em] text-[var(--azure)]">
            Ihr Unternehmen
          </p>
          <input
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              setOpen(true);
              if (
                !company ||
                next.trim().toLowerCase() !== company.name.toLowerCase()
              ) {
                onSelect(null);
              }
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true);
            }}
            placeholder="Unternehmen suchen …"
            className="w-full rounded-md border border-[var(--helper)] bg-white px-3 py-2.5 text-[18px] font-semibold tracking-[0.05em] text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--helper)]"
            autoComplete="off"
          />
          {open && q.length >= 2 && (
            <div className="absolute left-4 right-4 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-lg">
              {matches.length === 0 ? (
                <p className="px-4 py-3 text-[14px] text-[var(--helper)]">
                  Keine Treffer für „{query.trim()}“
                </p>
              ) : (
                <ul className="max-h-48 overflow-auto py-1">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-[var(--grey-96)]"
                        onClick={() => {
                          onSelect(c);
                          setQuery(c.name);
                          setOpen(false);
                        }}
                      >
                        <span className="text-[15px] font-semibold text-[var(--ink)]">
                          {c.name}
                        </span>
                        <span className="text-[12px] text-[var(--helper)]">
                          {c.source}
                          {c.level2_label_de ? ` · ${c.level2_label_de}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="space-y-0.5 text-[15px] leading-[1.35] tracking-[0.05em] text-[var(--ink)]">
          <p>✓  Kostenlos kennenlernen</p>
          <p>✓  Zum Start keine vertraulichen Daten nötig</p>
          <p>✓  Informationen später gezielt teilen</p>
        </div>

        <button
          type="button"
          disabled={!selectedOk}
          onClick={onNext}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-[30px] px-5 text-[15px] font-semibold tracking-[0.05em] text-white disabled:opacity-40"
          style={{ background: "var(--blue-2)" }}
        >
          Öffentliche Informationen laden
          <Image src="/brand/figma/cloud-download.svg" alt="" width={24} height={24} />
        </button>

        <p className="text-[12px] tracking-[0.05em] text-[var(--muted)]">
          Zum Start verwenden wir öffentlich zugängliche Unternehmensinformationen.
        </p>
      </div>

      <div
        className="hidden w-full max-w-[480px] shrink-0 rounded-[20px] p-5 lg:block"
        style={{ background: "var(--card)" }}
      >
        <div className="relative mb-3 h-[180px] w-full overflow-hidden xl:h-[220px]">
          <Image
            src="/brand/figma/illustration-welcome.png"
            alt=""
            fill
            className="object-contain"
            sizes="420px"
          />
        </div>
        <h2 className="text-[20px] font-semibold leading-[1.35] text-[var(--ink)]">
          Ihr Unternehmen. Ein klarer Überblick.
        </h2>
        <p className="mt-1.5 text-[15px] leading-[1.35] text-[var(--muted)]">
          Öffentliche Informationen bündeln, strukturiert nutzen und gezielt teilen.
        </p>
      </div>
    </div>
  );
}

function Processing({ companyName }: { companyName: string }) {
  return (
    <div
      className="flex flex-col gap-12 rounded-[20px] p-10 lg:flex-row lg:items-start"
      style={{ background: "var(--card)" }}
    >
      <div className="flex w-full max-w-[576px] flex-col gap-6">
        <div className="h-[266px] w-full max-w-[409px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/figma/illustration-processing.svg"
            alt=""
            className="h-full w-full object-contain object-left"
          />
        </div>
        <div className="space-y-4">
          <h1 className="text-[32px] font-semibold leading-[1.25] tracking-[0.05em] text-[var(--ink)]">
            Wir bereiten Ihr Unternehmensprofil vor
          </h1>
          <p className="text-[22px] font-semibold tracking-[0.05em] text-[var(--blue-2)]">
            {companyName}
          </p>
        </div>
        <p className="text-[17px] leading-[1.25] tracking-[0.05em] text-[var(--ink)]">
          BANKABLE führt öffentliche Informationen zusammen und ordnet sie den
          passenden Bereichen zu.
        </p>
        <p className="text-[15px] leading-[1.25] tracking-[0.05em] text-[var(--muted)]">
          Die verfügbaren Angaben können je nach Unternehmen unterschiedlich
          umfangreich sein.
        </p>
      </div>

      <div className="flex w-full max-w-[499px] flex-col gap-4">
        <StatusCard
          title="1. Öffentliche Informationen suchen"
          badge="Abgeschlossen"
          tone="done"
          icon="/brand/figma/check.svg"
        />
        <StatusCard
          title="2. Informationen strukturieren"
          badge="Wird verarbeitet"
          tone="active"
          icon="/brand/figma/loader.svg"
        />
        <StatusCard
          title="3. Unternehmensprofil vorbereiten"
          badge="Noch ausstehend"
          tone="todo"
          icon="/brand/figma/clock.svg"
        />
      </div>
    </div>
  );
}

function StatusCard({
  title,
  badge,
  tone,
  icon,
}: {
  title: string;
  badge: string;
  tone: "done" | "active" | "todo";
  icon: string;
}) {
  const badgeCls =
    tone === "done"
      ? "bg-[#f0fdf4] text-[#15803d]"
      : tone === "active"
        ? "bg-[#eef2ff] text-[#1d4ed8]"
        : "bg-[#f5f5f5] text-[#404040]";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#ceced5] bg-white p-6">
      <p className="text-[22px] font-semibold leading-[1.25] tracking-[0.05em] text-[var(--ink)]">
        {title}
      </p>
      <span
        className={`inline-flex w-fit items-center gap-1 rounded-2xl py-0.5 pl-2.5 pr-2 text-[14px] font-medium ${badgeCls}`}
      >
        <Image
          src={icon}
          alt=""
          width={12}
          height={12}
          className={tone === "active" ? "animate-spin" : undefined}
        />
        {badge}
      </span>
    </div>
  );
}

function Branche({
  catalog,
  suggestions,
  accepted,
  rows,
  pctSum,
  canContinue,
  onToggle,
  onAdd,
  onUpdate,
  onRemove,
  onNext,
}: {
  catalog: Catalog;
  suggestions: { pill: string; bankable_id: string }[];
  accepted: string[];
  rows: Row[];
  pctSum: number;
  canContinue: boolean;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Row>) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
}) {
  const [showManual, setShowManual] = useState(false);
  const selectedCount = rows.filter((r) => r.bankable_id).length;
  const showSelection = selectedCount > 0 || showManual;

  return (
    <div
      className="flex flex-col gap-6 rounded-2xl px-8 py-8 md:px-10"
      style={{ background: "var(--card)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[830px]">
          <h1 className="text-[26px] font-semibold leading-[1.45] text-[var(--ink)]">
            Welche Branchen passen zu Ihrem Unternehmen?
          </h1>
          <p className="mt-3 text-[17px] leading-[1.45] text-[var(--ink)]">
            AVA hat auf Basis öffentlicher Unternehmensinformationen passende
            Branchen vorgeschlagen. Prüfen Sie die Vorschläge und wählen Sie alle
            zutreffenden Branchen aus.
          </p>
        </div>
        <div
          className="flex w-[166px] shrink-0 flex-col gap-2 rounded-2xl px-5 py-3"
          style={{ background: "var(--progress-track)" }}
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/figma/sparkles.svg" alt="" width={22} height={22} />
            <span className="text-[32px] font-semibold tracking-[0.05em] text-[var(--blue-2)]">
              AVA
            </span>
          </div>
          <p className="text-[13px] font-semibold leading-[1.25] tracking-[0.05em] text-[var(--ink)]">
            Ihre KI-Assistentin
            <br />
            von BANKABLE
          </p>
        </div>
      </div>

      <div>
        <p className="mb-4 text-[18px] font-semibold text-[var(--ink)]">
          Vorschläge von AVA
        </p>
        {/* Figma: Aufbereitung Branche (neu) — suggestion pills */}
        <div className="flex flex-wrap gap-3">
          {suggestions.map((s) => {
            const on = accepted.includes(s.bankable_id);
            return (
              <button
                key={s.bankable_id}
                type="button"
                onClick={() => onToggle(s.bankable_id)}
                className="inline-flex items-center rounded-full border px-4 py-2.5 text-[15px] tracking-[0.02em] transition-colors"
                style={{
                  background: on ? "var(--ink)" : "white",
                  color: on ? "white" : "var(--ink)",
                  borderColor: on ? "var(--ink)" : "#c8c8d0",
                }}
              >
                {s.pill}
              </button>
            );
          })}
        </div>
      </div>

      {showSelection && (
        <div className="space-y-4">
          <div>
            <p className="text-[18px] font-semibold text-[var(--ink)]">Ihre Auswahl</p>
            <p className="mt-2 text-[15px] text-[var(--ink)]">
              Prüfen Sie die Zuordnung. Die Felder sind verknüpft und durchsuchbar —
              optional den ungefähren Umsatzanteil ergänzen.
            </p>
          </div>

          <div className="hidden gap-4 text-[13px] font-semibold text-[var(--helper)] md:grid md:grid-cols-[1.2fr_1.4fr_140px_32px]">
            <span>Branche</span>
            <span>Detailbranche</span>
            <span>Umsatzanteil</span>
            <span />
          </div>

          <div className="space-y-3">
            {rows
              .filter((r) => r.bankable_id || showManual || r.level1_id)
              .map((row) => {
                const l1Options = catalog.industry_level1.map((l1) => ({
                  value: l1.id,
                  label: l1.label_de,
                }));
                // Linked: L2 filtered by L1; if no L1 yet, all L2 (search can set L1)
                const l2Source = row.level1_id
                  ? catalog.industry_level2.filter((x) => x.level1_id === row.level1_id)
                  : catalog.industry_level2;
                const l2Options = l2Source.map((l2) => ({
                  value: l2.bankable_id,
                  label: l2.label_de,
                  hint: row.level1_id ? undefined : l2.level1_label_de,
                }));
                return (
                  <div
                    key={row.id}
                    className="grid gap-3 md:grid-cols-[1.2fr_1.4fr_140px_32px]"
                  >
                    <SearchableSelect
                      value={row.level1_id}
                      options={l1Options}
                      placeholder="Branche auswählen"
                      onChange={(level1_id) => onUpdate(row.id, { level1_id })}
                    />
                    <SearchableSelect
                      value={row.bankable_id}
                      options={l2Options}
                      placeholder="Detailbranche auswählen"
                      onChange={(bankable_id) => onUpdate(row.id, { bankable_id })}
                    />
                    <div className="relative">
                      <input
                        value={row.pct}
                        onChange={(e) =>
                          onUpdate(row.id, {
                            pct: e.target.value.replace(/[^\d.]/g, ""),
                          })
                        }
                        placeholder="Anteil"
                        className="h-11 w-full rounded-md border border-[var(--helper)] bg-white px-3 pr-10 text-[15px] outline-none"
                      />
                      <Image
                        src="/brand/figma/percent.svg"
                        alt=""
                        width={20}
                        height={20}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      className="text-[var(--helper)] hover:text-[var(--ink)]"
                      aria-label="Entfernen"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowManual(true);
              onAdd();
            }}
            className="inline-flex h-10 items-center gap-2 rounded-[30px] border border-[var(--ink)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)]"
          >
            <span aria-hidden>+</span> Branche hinzufügen
          </button>

          {rows.some((r) => r.pct !== "") && (
            <p
              className={`text-[15px] font-semibold ${
                Math.abs(pctSum - 100) < 0.6 ? "text-emerald-700" : "text-[var(--ink)]"
              }`}
            >
              Gesamtanteil: {pctSum} %
            </p>
          )}
        </div>
      )}

      {!showSelection && (
        <button
          type="button"
          onClick={() => {
            setShowManual(true);
            onAdd();
          }}
          className="inline-flex h-10 items-center gap-2 rounded-[30px] border border-[var(--ink)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)]"
        >
          <span aria-hidden>+</span> Branche hinzufügen
        </button>
      )}

      <div className="flex flex-col gap-4 border-t border-[var(--line)] pt-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[17px] font-semibold text-[var(--ink)]">
            {selectedCount === 0
              ? "Noch keine Branche ausgewählt"
              : selectedCount === 1
                ? "1 Branche ausgewählt"
                : `${selectedCount} Branchen ausgewählt`}
          </p>
          <p className="mt-1 text-[15px] text-[var(--ink)]">
            Sie können Ihre Auswahl später im Unternehmensprofil ändern.
          </p>
        </div>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onNext}
          className="h-10 shrink-0 rounded-[30px] border border-[var(--ink)] px-5 text-[15px] font-semibold text-[var(--ink)] disabled:opacity-40"
          style={
            canContinue
              ? { background: "var(--blue-2)", color: "white", borderColor: "var(--blue-2)" }
              : undefined
          }
        >
          {canContinue ? "Speichern und weiter →" : "Branche auswählen"}
        </button>
      </div>
    </div>
  );
}

function Success({
  companyName,
  rows,
  byId,
  onBack,
  onStart,
}: {
  companyName: string;
  rows: Row[];
  byId: Map<string, Level2>;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-6">
      <div
        className="flex flex-col gap-8 rounded-2xl p-8 md:p-10"
        style={{ background: "var(--card)" }}
      >
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[720px]">
            <h1 className="text-[32px] font-semibold leading-[1.25] tracking-[0.05em] text-[var(--ink)] md:text-[42px]">
              Ihr erster Überblick steht bereit!
            </h1>
            <p className="mt-4 text-[17px] leading-[1.25] tracking-[0.05em] text-[var(--ink)]">
              Die verfügbaren öffentlichen Informationen sind jetzt in Ihrem
              Unternehmensprofil gebündelt.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/figma/illustration-success.svg"
            alt=""
            className="h-[180px] w-auto max-w-[280px] object-contain"
          />
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--helper)]">
            Vorschau · Allgemeine Unternehmensdaten
          </p>
          <p className="mt-1 text-[18px] font-semibold text-[var(--ink)]">
            {companyName}
          </p>
          <div className="mt-5">
            <BranchenViz rows={rows} byId={byId} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex h-10 items-center gap-2 rounded-[30px] px-5 text-[15px] font-semibold text-white"
            style={{ background: "var(--blue-2)" }}
          >
            Bankable starten
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/figma/rocket.svg" alt="" width={24} height={24} />
          </button>
          <button
            type="button"
            onClick={onBack}
            className="h-10 rounded-[30px] border border-[var(--ink)] px-5 text-[15px] font-semibold text-[var(--ink)]"
          >
            Zurück zur Branchenwahl
          </button>
        </div>
      </div>
    </div>
  );
}
