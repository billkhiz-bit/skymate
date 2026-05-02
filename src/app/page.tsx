"use client";

import { useEffect, useRef, useState } from "react";
import LondonMap, { type HeatmapPoint } from "@/components/LondonMap";
import { resolveToPostcode, type ResolveResult } from "@/lib/area-postcodes";

type RecentQuery = {
  postcode: string;
  preference: string;
  summaryPreview: string;
  ts: string;
};

type Pollutants = { no2: number; pm25: number; pm10: number };
type DefraReading = {
  stationName: string;
  distanceKm: number;
  pollutants: Pollutants;
};
type FlightInfo = {
  intensity: number;
  primaryCorridor: string;
  altitudeBand: string;
};
type SimilarPostcodeBrief = { postcode: string; name: string; score: number };

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

const PREFERENCES = ["default", "family", "air", "quiet", "flights", "custom"] as const;
type Preference = (typeof PREFERENCES)[number];

const PREFERENCE_LABELS: Record<Preference, { short: string; long: string }> = {
  default: { short: "Balanced", long: "No preference - balance air, similarity, and flight noise equally" },
  family: { short: "Family with kids", long: "Prioritise air quality + low noise; mention parks and quiet streets" },
  air: { short: "Air quality first", long: "Lead with the highest pollutant; respiratory-sensitive framing" },
  quiet: { short: "Quiet preferred", long: "Lean on similar peaceful neighbours; emphasise noise sources" },
  flights: { short: "Avoid flight paths", long: "Flight intensity dominates - overhead aircraft is the top concern" },
  custom: { short: "Describe your needs", long: "Type in plain English - the agent decomposes intent into source weights" },
};

type IntentDecomposition = {
  defraWeight: number;
  vectorWeight: number;
  flightWeight: number;
  focus: string;
  reasoning: string;
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
  intent?: string;
  intentDecomposition?: IntentDecomposition;
  summary: string;
  sources: string[];
  trace: TraceStep[];
  sessionId?: string;
  defra?: DefraReading[];
  flight?: FlightInfo;
  similar?: SimilarPostcodeBrief[];
};

const LOADING_STAGES = [
  "decomposing query…",
  "pulling DEFRA stations…",
  "vector-searching neighbours…",
  "checking flight corridors…",
  "synthesising with Haiku 4.5…",
];

async function fetchOne(postcode: string, preference: Preference, intent?: string): Promise<SynthesiseResponse> {
  const params = new URLSearchParams({
    postcode,
    preference,
  });
  if (preference === "custom" && intent) params.set("intent", intent);
  const res = await fetch(`/api/synthesise?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchVerdict(args: {
  postcodeA: string;
  postcodeB: string;
  resultA: SynthesiseResponse;
  resultB: SynthesiseResponse;
  preference: Preference;
}): Promise<string | null> {
  try {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postcodeA: args.postcodeA,
        postcodeB: args.postcodeB,
        summaryA: args.resultA.summary,
        summaryB: args.resultB.summary,
        defraA: args.resultA.defra ?? [],
        defraB: args.resultB.defra ?? [],
        flightA: args.resultA.flight,
        flightB: args.resultB.flight,
        preference: args.preference,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.verdict === "string" ? data.verdict : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [inputA, setInputA] = useState("Hampstead");
  const [inputB, setInputB] = useState("SE10");
  const [preference, setPreference] = useState<Preference>("default");
  const [intentText, setIntentText] = useState("I'm asthmatic with two young kids and work nights - somewhere with low pollution and quiet for sleeping.");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [resolvedA, setResolvedA] = useState<ResolveResult | null>(null);
  const [resolvedB, setResolvedB] = useState<ResolveResult | null>(null);
  const [resultA, setResultA] = useState<SynthesiseResponse | null>(null);
  const [resultB, setResultB] = useState<SynthesiseResponse | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentQuery[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const previewA = resolveToPostcode(inputA);
  const previewB = resolveToPostcode(inputB);

  async function refreshHistory() {
    try {
      const res = await fetch("/api/history", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      setRecent(Array.isArray(data.recent) ? data.recent : []);
    } catch {
      // Non-fatal - history is best-effort.
    }
  }

  async function refreshHeatmap() {
    setHeatmapLoading(true);
    try {
      const res = await fetch("/api/heatmap");
      if (res.ok) {
        const data = await res.json();
        setHeatmap(Array.isArray(data.rows) ? data.rows : []);
      }
    } catch {
      // Non-fatal.
    } finally {
      setHeatmapLoading(false);
    }
  }

  async function toggleHeatmap() {
    if (!showHeatmap) {
      await refreshHeatmap();
    }
    setShowHeatmap((s) => !s);
  }

  useEffect(() => {
    refreshHistory();
  }, []);

  // Rotate the loading stage label while a query is in flight.
  useEffect(() => {
    if (!loading) return;
    setLoadingStage(0);
    const id = setInterval(() => {
      setLoadingStage((s) => (s + 1) % LOADING_STAGES.length);
    }, 700);
    return () => clearInterval(id);
  }, [loading]);

  function applyRecent(r: RecentQuery, slot: "A" | "B") {
    if (slot === "A") setInputA(r.postcode);
    else setInputB(r.postcode);
    if ((PREFERENCES as readonly string[]).includes(r.preference)) {
      setPreference(r.preference as Preference);
    }
  }

  async function runCompare(a: ResolveResult, b: ResolveResult, prof: Preference, intent?: string) {
    setResolvedA(a);
    setResolvedB(b);
    setLoading(true);
    setError(null);
    setResultA(null);
    setResultB(null);
    setVerdict(null);
    try {
      const [resA, resB] = await Promise.all([
        fetchOne(a.postcode, prof, intent),
        fetchOne(b.postcode, prof, intent),
      ]);
      setResultA(resA);
      setResultB(resB);
      refreshHistory();

      // Fire the verdict synthesis after both summaries are in.
      setVerdictLoading(true);
      const v = await fetchVerdict({
        postcodeA: a.postcode,
        postcodeB: b.postcode,
        resultA: resA,
        resultB: resB,
        preference: prof,
      });
      setVerdict(v);
      setVerdictLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function compare(e: React.FormEvent) {
    e.preventDefault();
    const a = resolveToPostcode(inputA);
    const b = resolveToPostcode(inputB);
    await runCompare(a, b, preference, preference === "custom" ? intentText : undefined);
  }

  async function runDemoSeed() {
    setInputA("Hampstead");
    setInputB("Greenwich");
    setPreference("family");
    const a = resolveToPostcode("Hampstead");
    const b = resolveToPostcode("Greenwich");
    await runCompare(a, b, "family");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-stone-50 to-white text-slate-800 font-sans">
      <main className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">SkyMate</h1>
            <span className="text-sm text-sky-700 font-mono px-2 py-0.5 bg-sky-100 rounded-full">
              Adaptive Retrieval for London postcodes
            </span>
          </div>
          <p className="text-slate-600 text-base max-w-2xl leading-relaxed">
            Compare any two London postcodes - or borough names - on live air quality, noise, and similarity to areas you already know.
            Pick a profile and watch the agent re-weight its sources. The decision trace shows exactly which data it pulled and how heavily it leaned on each.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={runDemoSeed}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              ▶ Try the demo: Hampstead vs Greenwich · Family with kids
            </button>
          </div>
        </header>

        <form
          ref={formRef}
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
              className="h-11 px-6 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
            >
              {loading ? LOADING_STAGES[loadingStage] : "Compare"}
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Try: <ExampleChip onClick={() => setInputA("Hampstead")}>Hampstead</ExampleChip>{" "}
            <ExampleChip onClick={() => setInputB("Greenwich")}>Greenwich</ExampleChip>{" "}
            <ExampleChip onClick={() => setInputA("Shoreditch")}>Shoreditch</ExampleChip>{" "}
            <ExampleChip onClick={() => setInputB("Wimbledon")}>Wimbledon</ExampleChip>{" "}
            <ExampleChip onClick={() => setInputA("Canary Wharf")}>Canary Wharf</ExampleChip>{" "}
            <span className="text-slate-400">- borough or postcode both work</span>
          </div>

          <PreferenceSelector value={preference} onChange={setPreference} />

          {preference === "custom" && (
            <IntentInput value={intentText} onChange={setIntentText} />
          )}
        </form>

        <RecentStrip recent={recent} onApply={applyRecent} />

        {error && (
          <div className="border border-rose-300 bg-rose-50 text-rose-800 px-4 py-3 rounded-lg font-mono text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap -mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Map</span>
            <span className="text-xs text-slate-400 font-mono">animated corridors · live postcodes</span>
          </div>
          <button
            type="button"
            onClick={toggleHeatmap}
            disabled={heatmapLoading}
            className={
              "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors " +
              (showHeatmap
                ? "bg-rose-500 text-white border-rose-500 hover:bg-rose-600"
                : "bg-white text-slate-700 border-slate-300 hover:border-rose-400 hover:text-rose-700")
            }
            title="Aggregation pipeline over the air_quality time-series collection"
          >
            {heatmapLoading
              ? "loading…"
              : showHeatmap
              ? `▣ Hide pollution heatmap (${heatmap.length})`
              : "◰ Show pollution heatmap"}
          </button>
        </div>
        <LondonMap
          postcodes={[previewA.postcode, previewB.postcode].filter(Boolean)}
          heatmap={showHeatmap ? heatmap : undefined}
        />

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResultCard result={resultA} loading={loading} placeholder="Postcode A" resolved={resolvedA} stageText={LOADING_STAGES[loadingStage]} />
          <ResultCard result={resultB} loading={loading} placeholder="Postcode B" resolved={resolvedB} stageText={LOADING_STAGES[loadingStage]} />
        </section>

        {(verdict || verdictLoading) && (
          <VerdictPanel verdict={verdict} loading={verdictLoading} preference={preference} />
        )}

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

function IntentInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
      <label className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Describe your needs</span>
          <span className="text-xs text-emerald-700 font-mono">
            ↳ Bedrock decomposer infers source weights from your text
          </span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          maxLength={400}
          placeholder="e.g. I'm asthmatic with two young kids and work nights"
          className="px-3 py-2 rounded-lg bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 resize-none"
        />
      </label>
      <div className="text-[11px] text-slate-500 italic">
        Try: <button type="button" onClick={() => onChange("I'm asthmatic and work from home - air quality matters most.")} className="underline hover:text-emerald-700">asthmatic + WFH</button>
        {" · "}
        <button type="button" onClick={() => onChange("Night shift worker - I sleep during the day, so overhead planes are a problem.")} className="underline hover:text-emerald-700">night shift</button>
        {" · "}
        <button type="button" onClick={() => onChange("Family with two young kids and a baby - air quality and quiet streets matter most.")} className="underline hover:text-emerald-700">family</button>
        {" · "}
        <button type="button" onClick={() => onChange("Find me somewhere similar in vibe to NW3 but cheaper.")} className="underline hover:text-emerald-700">similar to NW3</button>
      </div>
    </div>
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

// ---------------------------------------------------------------------------
// Pollutant thresholds - visual band indicators only. NOT health advice.
// Bands chosen for legibility against typical London ambient ranges.
// ---------------------------------------------------------------------------
type Band = "low" | "moderate" | "elevated";
const BAND_COLOR: Record<Band, string> = {
  low: "bg-emerald-500",
  moderate: "bg-amber-500",
  elevated: "bg-rose-500",
};
const BAND_LABEL: Record<Band, string> = {
  low: "low",
  moderate: "moderate",
  elevated: "elevated",
};

function bandFor(pollutant: "no2" | "pm25" | "pm10", value: number): Band {
  if (pollutant === "no2") return value < 40 ? "low" : value < 80 ? "moderate" : "elevated";
  if (pollutant === "pm25") return value < 12 ? "low" : value < 25 ? "moderate" : "elevated";
  return value < 25 ? "low" : value < 50 ? "moderate" : "elevated";
}

function PollutantPill({ name, value, unit, band }: { name: string; value: number; unit: string; band: Band }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-full bg-slate-50 border border-slate-200">
      <span className={`w-1.5 h-1.5 rounded-full ${BAND_COLOR[band]}`} title={`${BAND_LABEL[band]} band`} />
      <span className="text-slate-500">{name}</span>
      <span className="text-slate-900 font-semibold">{value}</span>
      <span className="text-slate-400">{unit}</span>
    </div>
  );
}

function ResultCard({
  result,
  loading,
  placeholder,
  resolved,
  stageText,
}: {
  result: SynthesiseResponse | null;
  loading: boolean;
  placeholder: string;
  resolved: ResolveResult | null;
  stageText: string;
}) {
  // Fade-in (#4): mounted flips true shortly after a result arrives so the
  // CSS transition fires from "off" to "on" state.
  const [mounted, setMounted] = useState(false);
  // Typewriter (#1): reveal the summary character-by-character once data lands.
  const [revealed, setRevealed] = useState(0);

  const summary = result?.summary ?? "";
  const cardKey = result ? `${result.postcode}-${result.preference}-${summary.length}` : null;

  useEffect(() => {
    if (!result) {
      setMounted(false);
      setRevealed(0);
      return;
    }
    setMounted(false);
    setRevealed(0);
    const fadeId = setTimeout(() => setMounted(true), 30);
    // Speed: ~14ms per char => ~70 chars/sec => ~150 char summary reveals in ~2s.
    const typeId = setInterval(() => {
      setRevealed((r) => {
        if (r >= summary.length) {
          clearInterval(typeId);
          return r;
        }
        return r + 2; // 2 chars per tick for snappier reveal on long summaries
      });
    }, 14);
    return () => {
      clearTimeout(fadeId);
      clearInterval(typeId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  if (!result && loading) {
    return (
      <div className="border border-slate-200 bg-white rounded-2xl p-5 min-h-[200px] flex items-center justify-center shadow-sm">
        <div className="text-slate-500 text-sm font-mono animate-pulse">{stageText}</div>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="border border-slate-200 border-dashed bg-white/40 rounded-2xl p-5 min-h-[200px] flex items-center justify-center">
        <div className="text-slate-400 text-sm">{placeholder} - no result yet</div>
      </div>
    );
  }

  const closest = result.defra?.[0];
  const visibleSummary = summary.slice(0, revealed);
  const isTyping = revealed < summary.length;

  return (
    <article
      className={
        "border border-slate-200 bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-sm transition-all duration-500 ease-out " +
        (mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95")
      }
    >
      <header className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-2xl font-semibold font-mono text-slate-900">{result.postcode}</h2>
          {resolved?.fromArea && resolved.areaName && (
            <span className="text-xs text-slate-500">- {resolved.areaName}</span>
          )}
        </div>
        {result.preference && result.preference !== "default" && (
          <span className="text-[10px] uppercase tracking-wider text-sky-700 font-mono px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200">
            {PREFERENCE_LABELS[result.preference].short}
          </span>
        )}
      </header>

      {closest && (
        <div className="flex flex-wrap gap-1.5">
          <PollutantPill name="NO₂" value={closest.pollutants.no2} unit="µg/m³" band={bandFor("no2", closest.pollutants.no2)} />
          <PollutantPill name="PM₂.₅" value={closest.pollutants.pm25} unit="µg/m³" band={bandFor("pm25", closest.pollutants.pm25)} />
          <PollutantPill name="PM₁₀" value={closest.pollutants.pm10} unit="µg/m³" band={bandFor("pm10", closest.pollutants.pm10)} />
          {result.flight && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-full bg-slate-50 border border-slate-200">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  result.flight.intensity < 0.35 ? "bg-emerald-500" : result.flight.intensity < 0.65 ? "bg-amber-500" : "bg-rose-500"
                }`}
              />
              <span className="text-slate-500">flight</span>
              <span className="text-slate-900 font-semibold">{result.flight.intensity.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap min-h-[80px]">
        {visibleSummary}
        {isTyping && <span className="inline-block w-1 h-3.5 bg-sky-600 align-middle ml-0.5 animate-pulse" />}
      </div>

      {result.similar && result.similar.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Similar to</span>
          {result.similar.map((s, i) => (
            <span
              key={`${s.postcode}-${i}`}
              className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono"
              title={`${s.name} · cosine ${s.score.toFixed(3)}`}
            >
              <span className="font-semibold">{s.postcode}</span>
              <span className="text-emerald-600/70"> · {s.name}</span>
            </span>
          ))}
          <span className="text-[10px] text-slate-400 font-mono italic ml-1">via Atlas Vector Search</span>
        </div>
      )}

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

function VerdictPanel({ verdict, loading, preference }: { verdict: string | null; loading: boolean; preference: Preference }) {
  return (
    <section className="border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-sky-50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-emerald-800">Agent verdict</h3>
        <span className="text-xs text-slate-500 font-mono">
          second Bedrock pass · weighted to {PREFERENCE_LABELS[preference].short.toLowerCase()}
        </span>
      </div>
      {loading || !verdict ? (
        <div className="text-slate-500 text-sm font-mono animate-pulse">writing the verdict…</div>
      ) : (
        <p className="text-slate-800 text-base leading-relaxed">{verdict}</p>
      )}
    </section>
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
        <div key={i} className="flex flex-col gap-1 py-2 border-b border-slate-900 last:border-b-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-mono text-emerald-400">{s.step}</span>
            <span className="text-[10px] text-slate-500 font-mono tabular-nums">
              w={s.weight.toFixed(2)} · {s.tookMs}ms
            </span>
          </div>
          {/* #2 Animated weight bar - width transitions when profile changes the weight. */}
          <div className="w-full h-1 bg-slate-800/70 rounded-full overflow-hidden">
            <div
              className={
                "h-full rounded-full transition-all duration-700 ease-out " +
                (s.weight >= 0.7 ? "bg-emerald-400" : s.weight >= 0.4 ? "bg-sky-400" : "bg-slate-500")
              }
              style={{ width: `${Math.min(100, Math.max(2, s.weight * 100))}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 font-mono">{s.source}</div>
          <div className="text-xs text-slate-300">{s.summary}</div>
        </div>
      ))}
    </div>
  );
}
