/**
 * Server-side college dataset + methodology, so the connector alone is a
 * complete experience (no skill install required). Data files live in
 * DATA_DIR (default ./data): colleges.csv + methodology.md + interview.md +
 * DATA_NOTES.md — copies of the college-money-finder skill's versions; the
 * cds-refresh pipeline updates both.
 *
 * The tier logic mirrors the skill's scripts/shortlist.py — keep in sync.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");

// minimal CSV parser (handles quoted fields with commas/newlines)
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const num = (v: string | undefined) => (v === undefined || v === "" ? null : Number(v));

export type CollegeRow = Record<string, string>;
let COLLEGES: CollegeRow[] = [];
let PLAYBOOK = "";
try {
  COLLEGES = parseCsv(readFileSync(join(DATA_DIR, "colleges.csv"), "utf8"));
  PLAYBOOK = [
    "# Counseled money-fit playbook\n",
    readFileSync(join(DATA_DIR, "methodology.md"), "utf8"),
    "\n\n# The family interview\n",
    readFileSync(join(DATA_DIR, "interview.md"), "utf8"),
    "\n\n# Data provenance and caveats\n",
    readFileSync(join(DATA_DIR, "DATA_NOTES.md"), "utf8"),
  ].join("");
} catch (e) {
  console.error("college data not loaded:", e);
}
export const collegeDataLoaded = () => COLLEGES.length > 0;

// ---- tier logic (mirror of shortlist.py) ----
const MERIT_RATE_TARGET = 0.15;
const FULLPAY_RATE = 0.05;
const BUDGET_SLACK = 3000;
const INFLATION = 0.035;
const CURRENT_CDS_YEAR = 2023;

function inflate(amount: number | null, year: string): number | null {
  if (amount == null) return null;
  const start = parseInt(String(year).split("-")[0], 10);
  const years = Number.isFinite(start) ? Math.max(0, CURRENT_CDS_YEAR - start) : 0;
  return Math.round(amount * Math.pow(1 + INFLATION, years));
}

function statPosition(row: CollegeRow, sat: number | null, act: number | null, gpa: number | null): string {
  const s25 = num(row.sat_25), s75 = num(row.sat_75), a25 = num(row.act_25), a75 = num(row.act_75), g = num(row.avg_gpa);
  if (sat && s75) return sat >= s75 ? "top" : s25 && sat >= s25 ? "mid" : "below";
  if (act && a75) return act >= a75 ? "top" : a25 && act >= a25 ? "mid" : "below";
  if (gpa && g) return gpa >= g + 0.15 ? "top" : gpa >= g - 0.2 ? "mid" : "below";
  return "unknown";
}

export function classify(row: CollegeRow, p: { budget: number; sat?: number | null; act?: number | null; gpa?: number | null; home_state?: string | null }) {
  const inState = p.home_state && row.state === p.home_state;
  let coa = num(inState ? row.coa_in : row.coa_out) ?? num(row.coa_out);
  if (coa == null) return null;
  coa = inflate(coa, row.year)!;
  const meritRate = num(row.pct_no_need_merit);
  const avgMerit = inflate(num(row.avg_merit), row.year);
  const priceAfter = avgMerit != null ? coa - avgMerit : null;
  const pos = statPosition(row, p.sat ?? null, p.act ?? null, p.gpa ?? null);

  let tier: string;
  if (coa <= p.budget) tier = "lock";
  else if (priceAfter != null && priceAfter <= p.budget + BUDGET_SLACK) {
    tier = meritRate != null && meritRate >= MERIT_RATE_TARGET && (pos === "top" || pos === "mid") ? "conditional_target" : "merit_lottery";
  } else if (meritRate != null && meritRate < FULLPAY_RATE) tier = "full_pay_or_bust";
  else tier = "over_budget";

  return {
    school: row.school, state: row.state, year: row.year, tier,
    stat_position: pos, coa, in_state_price_used: Boolean(inState),
    merit_rate_no_need: meritRate, avg_merit: avgMerit, price_after_merit: priceAfter,
    avg_pct_need_met: num(row.avg_pct_need_met),
    meets_full_need: (num(row.avg_pct_need_met) ?? 0) >= 95,
    admit_rate: num(row.admit_rate), sat_75: num(row.sat_75), test_policy: row.test_policy,
    confidence: row.confidence, flags: row.flags, notes: (row.notes || "").slice(0, 200),
  };
}

export function searchColleges(p: { budget: number; sat?: number | null; act?: number | null; gpa?: number | null; home_state?: string | null }) {
  const out: Record<string, any[]> = { lock: [], conditional_target: [], merit_lottery: [], full_pay_or_bust: [], over_budget: [] };
  for (const row of COLLEGES) {
    const r = classify(row, p);
    if (r) out[r.tier].push(r);
  }
  for (const tier of ["lock", "conditional_target", "merit_lottery"])
    out[tier].sort((a, b) => (b.merit_rate_no_need ?? 0) - (a.merit_rate_no_need ?? 0) || (a.price_after_merit ?? a.coa) - (b.price_after_merit ?? b.coa));
  return out;
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
export function findCollege(name: string): CollegeRow | null {
  const n = normName(name);
  return (
    COLLEGES.find((r) => normName(r.school) === n) ||
    COLLEGES.find((r) => normName(r.school).includes(n) || n.includes(normName(r.school))) ||
    null
  );
}

export function playbook(): string {
  return PLAYBOOK || "playbook unavailable";
}
