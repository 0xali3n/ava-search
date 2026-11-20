export type Level1 = {
  id: string;
  label_de: string;
  level2_count: number;
  sort_order: number;
};

export type Level2 = {
  bankable_id: string;
  level1_id: string;
  level1_label_de: string;
  label_de: string;
  wz2025_leitcodes: string;
  nace_rev21: string;
  mapping_type: string;
  note_de: string;
  source_url: string;
};

export type Catalog = {
  meta: {
    version: string;
    source: string;
    level1_count: number;
    level2_count: number;
  };
  industry_level1: Level1[];
  industry_level2: Level2[];
};

export type DemoCompany = {
  id: string;
  name: string;
  source: string;
  level1_id: string | null;
  bankable_id: string | null;
  level1_label_de: string | null;
  level2_label_de: string | null;
  /** Optional AVA suggestion set for demo (BANKABLE L2 ids) */
  suggest_bankable_ids?: string[];
  /** Which suggestions are auto-checked when Branchen opens (demo) */
  preselect_bankable_ids?: string[];
  /** Optional demo Umsatzanteile keyed by bankable_id, e.g. {"B11.08":"70"} */
  demo_shares?: Record<string, string>;
};

export type DemoCompanies = {
  meta: { sources: string[]; count: number };
  companies: DemoCompany[];
};

/** Used by /catalog explorer */
export type SampleCompany = {
  name: string;
  level1_label_de: string;
  level2_label_de: string;
  level1_id: string | null;
  bankable_id: string | null;
  wz2025: string;
  zuordnung: string;
  kommentar: string;
};
