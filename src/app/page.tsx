"use client";

import { useEffect, useState } from "react";
import LondonMap from "@/components/LondonMap";
import { resolveToPostcode, type ResolveResult } from "@/lib/area-postcodes";

type RecentQuery = {
  postcode: string;
  preference: string;
  summaryPreview: string;
  ts: string;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const PREFERENCES = ["default", "family", "air", "quiet", "flights"] as const;
type Preference = (typeof PREFERENCES)[number];

const PREFERENCE_LABELS: Record<Preference, { short: string; long: string }> = {
  default: { short: "Balanced", long: "No preference — balance air, similarity, and flight noise equally" },
  family: { short: "Family with kids", long: "Prioritise air quality + low noise; mention parks and quiet streets" },
  air: { short: "Air quality first", long: "Lead with the highest pollutant; respiratory-sensitive framing" },
  quiet: { short: "Quiet preferred", long: "Lean on similar peaceful neighbours; emphasise noise sources" },
  flights: { short: "Avoid flight paths", long: "Flight intensity dominates — overhead aircraft is the top concern" },
};

type TraceStep = {
  step: string;
  source: string;
  weight: number;
  tookMs: number;
  summary: string;
};

type SynthesiseResponse = {
  postcode: string;
  preference?: Preference;
  summary: string;
  sources: string[];
  trace: TraceStep[];
  sessionId?: string;
};

async function fetchOne(postcode: string, preference: Preference): Promise<SynthesiseResponse> {
  const res = await fetch(
    `/api/synthesise?postcode=${encodeURIComponent(postcode)}&preference=${preference}`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default function Home() {
  const [inputA, setInputA] = useState("Hampstead");
  const [inputB, setInputB] = useState("SE10");
  const [preference, setPreference] = useState<Preference>("default");
  const [loading, setLoading] = useState(false);
  const [resolvedA, setResolvedA] = useState<ResolveResult | null>(null);
  const [resolvedB, setResolvedB] = useState<ResolveResult | null>(null);
  const [resultA, setResultA] = useState<SynthesiseResponse | null>(null);
  const [resultB, setResultB] = useState<SynthesiseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentQuery[]>([]);

  const previewA = resolveToPostcode(inputA);
  const previewB = resolveToPostcode(inputB);

  async function refreshHistory() {
    try {
      const res = await fetch("/api/history", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      setRecent(Array.isArray(data.recent) ? data.recent : []);
    } catch {
      // Non-fatal — history is best-effort.
    }
  }

  useEffect(() => {
    refreshHistory();
  }, []);

  function applyRecent(r: RecentQuery, slot: "A" | "B") {
    if (slot === "A") setInputA(r.postcode);
    else setInputB(r.postcode);
    if ((PREFERENCES as readonly string[]).includes(r.preference)) {
      setPreference(r.preference as Preference);
    }
  }

  async function compare(e: React.FormEvent) {
    e.preventDefault();
    const a = resolveToPostcode(inputA);
    const b = resolveToPostcode(inputB);
    setResolvedA(a);
    setResolvedB(b);
    setLoading(true);
    setError(null);
    setResultA(null);
    setResultB(null);
    try {
      const [resA, resB] = await Promise.all([
        fetchOne(a.postcode, preference),
        fetchOne(b.postcode, preference),
      ]);
      setResultA(resA);
      setResultB(resB);
      refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-stone-50 to-white text-slate-800 font-sans">
      <main className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">SkyMate</h1>
            <span className="text-sm text-sky-700 font-mono px-2 py-0.5 bg-sky-100 rounded-full">
              Adaptive Retrieval for UK postcodes
            </span>
          </div>
          <p className="text-slate-600 text-base max-w-2xl leading-relaxed">
            Compare any two UK postcodes — or borough names — on live air quality, noise, and similarity to areas you already know.
            Pick a profile and watch the agent re-weight its sources. The decision trace shows exactly which data it pulled and how heavily it leaned on each.
          </p>
        </header>

        <form
          onSubmit={compare}
          className="flex flex-col gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <PostcodeInput
              label="Postcode A"
              value={inputA}
              onChange={setInputA}
              preview={previewA}
            />
            <PostcodeInput
              label="Postcode B"
              value={inputB}
              onChange={setInputB}
              preview={previewB}
            />
            <button
              type="submit"
              disabled={loading || !inputA || !inputB}
              className="h-11 px-6 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? "Asking the agent…" : "Compare"}
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Try: <ExampleChip onClick={() => setInputA("Hampstead")}>Hampstead</ExampleChip>{" "}
            <ExampleChip onClick={() => setInputB("Greenwich")}>Greenwich</ExampleChip>{" "}
            <ExampleChip onClick={() => setInputA("Shoreditch")}>Shoreditch</ExampleChip>{" "}
            <ExampleChip onClick={() => setInputB("Wimbledon")}>Wimbledon</ExampleChip>{" "}
            <ExampleChip onClick={() => setInputA("Canary Wharf")}>Canary Wharf</ExampleChip>{" "}
            <span className="text-slate-400">— borough or postcode both work</span>
          </div>

          <PreferenceSelector value={preference} onChange={setPreference} />
        </form>

        <RecentStrip recent={recent} onApply={applyRecent} />

        {error && (
          <div className="border border-rose-300 bg-rose-50 text-rose-800 px-4 py-3 rounded-lg font-mono text-sm">
            {error}
          </div>
        )}

        <LondonMap postcodes={[previewA.postcode, previewB.postcode].filter(Boolean)} />

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResultCard result={resultA} loading={loading} placeholder="Postcode A" resolved={resolvedA} />
          <ResultCard result={resultB} loading={loading} placeholder="Postcode B" resolved={resolvedB} />
        </section>

        {(resultA || resultB) && (
          <TracePanel left={resultA} right={resultB} />
        )}

        <footer className="text-xs text-slate-500 font-mono pt-8 border-t border-slate-200 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-slate-400">powered by</span>
          <span className="px-2 py-0.5 rounded bg-slate-100">MongoDB Atlas</span>
          <span className="px-2 py-0.5 rounded bg-slate-100">Vector Search</span>
          <span className="px-2 py-0.5 rounded bg-slate-100">Time-series</span>
          <span className="px-2 py-0.5 rounded bg-slate-100">Bedrock Haiku 4.5</span>
          <span className="px-2 py-0.5 rounded bg-slate-100">DEFRA UK-AIR</span>
        </footer>
      </main>
    </div>
  );
}

function RecentStrip({ recent, onApply }: { recent: RecentQuery[]; onApply: (r: RecentQuery, slot: "A" | "B") => void }) {
  if (!recent.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Recently asked · this session</span>
        <span className="text-xs text-slate-400 font-mono">remembered via MongoDB Atlas · click to refill</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recent.map((r, i) => (
          <div
            key={`${r.ts}-${i}`}
            className="flex-shrink-0 flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-3 pr-1 py-1 shadow-sm"
            title={r.summaryPreview}
          >
            <span className="font-mono text-sm text-slate-800 font-semibold">{r.postcode}</span>
            <span className="text-xs text-sky-700 px-1.5 py-0.5 bg-sky-50 rounded-full font-mono">
              {r.preference}
            </span>
            <span className="text-xs text-slate-400 font-mono">{timeAgo(r.ts)}</span>
            <button
              type="button"
              onClick={() => onApply(r, "A")}
              className="text-[10px] uppercase font-mono px-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-700 transition-colors"
              aria-label={`Set ${r.postcode} as Postcode A`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => onApply(r, "B")}
              className="text-[10px] uppercase font-mono px-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-700 transition-colors"
              aria-label={`Set ${r.postcode} as Postcode B`}
            >
              B
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostcodeInput({
  label,
  value,
  onChange,
  preview,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  preview: ResolveResult;
}) {
  return (
    <label className="flex flex-col gap-1 flex-1">
      <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. NW3 or Hampstead"
        className="h-11 px-3 rounded-lg bg-white border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 focus:outline-none font-mono text-sm text-slate-900 placeholder:text-slate-400"
      />
      {preview.fromArea && preview.postcode && (
        <span className="text-[11px] text-sky-700 font-mono">
          ↳ resolves to <span className="font-semibold">{preview.postcode}</span>
        </span>
      )}
    </label>
  );
}

function ExampleChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-block px-2 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 hover:bg-sky-100 transition-colors text-xs"
    >
      {children}
    </button>
  );
}

function PreferenceSelector({ value, onChange }: { value: Preference; onChange: (p: Preference) => void }) {
  const active = PREFERENCE_LABELS[value];
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Profile</span>
        <span className="text-xs text-slate-500 italic">{active.long}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PREFERENCES.map((p) => {
          const isActive = p === value;
          return (
            <button
              type="button"
              key={p}
              onClick={() => onChange(p)}
              className={
                isActive
                  ? "px-4 py-1.5 rounded-full text-sm font-medium bg-sky-600 text-white shadow-sm transition-colors"
                  : "px-4 py-1.5 rounded-full text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:border-sky-400 hover:text-sky-700 transition-colors"
              }
            >
              {PREFERENCE_LABELS[p].short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  loading,
  placeholder,
  resolved,
}: {
  result: SynthesiseResponse | null;
  loading: boolean;
  placeholder: string;
  resolved: ResolveResult | null;
}) {
  if (!result && loading) {
    return (
      <div className="border border-slate-200 bg-white rounded-2xl p-5 min-h-[200px] flex items-center justify-center shadow-sm">
        <div className="text-slate-400 text-sm font-mono animate-pulse">retrieving…</div>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="border border-slate-200 border-dashed bg-white/40 rounded-2xl p-5 min-h-[200px] flex items-center justify-center">
        <div className="text-slate-400 text-sm">{placeholder} — no result yet</div>
      </div>
    );
  }
  return (
    <article className="border border-slate-200 bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
      <header className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-2xl font-semibold font-mono text-slate-900">{result.postcode}</h2>
          {resolved?.fromArea && resolved.areaName && (
            <span className="text-xs text-slate-500">— {resolved.areaName}</span>
          )}
        </div>
        {result.preference && result.preference !== "default" && (
          <span className="text-[10px] uppercase tracking-wider text-sky-700 font-mono px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200">
            {PREFERENCE_LABELS[result.preference].short}
          </span>
        )}
      </header>
      <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
        {result.summary}
      </div>
      {result.sources?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100">
          {result.sources.map((s, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 font-mono">
              {s}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function TracePanel({ left, right }: { left: SynthesiseResponse | null; right: SynthesiseResponse | null }) {
  return (
    <section className="border border-slate-800 rounded-2xl overflow-hidden shadow-md">
      <header className="flex items-center justify-between bg-slate-900 px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold tracking-wide text-slate-100">Decision trace</h3>
        <span className="text-xs text-slate-400 font-mono">weights shift with profile · proves adaptive retrieval</span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-950">
        <TraceColumn label={left?.postcode ?? "A"} steps={left?.trace ?? []} />
        <TraceColumn label={right?.postcode ?? "B"} steps={right?.trace ?? []} />
      </div>
    </section>
  );
}

function TraceColumn({ label, steps }: { label: string; steps: TraceStep[] }) {
  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-mono">{label}</div>
      {steps.length === 0 && <div className="text-xs text-slate-700">no trace</div>}
      {steps.map((s, i) => (
        <div key={i} className="flex flex-col gap-0.5 py-2 border-b border-slate-900 last:border-b-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-mono text-emerald-400">{s.step}</span>
            <span className="text-[10px] text-slate-500 font-mono">
              w={s.weight.toFixed(2)} · {s.tookMs}ms
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono">{s.source}</div>
          <div className="text-xs text-slate-300">{s.summary}</div>
        </div>
      ))}
    </div>
  );
}
