"use client";

import { useState } from "react";
import LondonMap from "@/components/LondonMap";

type TraceStep = {
  step: string;
  source: string;
  weight: number;
  tookMs: number;
  summary: string;
};

type SynthesiseResponse = {
  postcode: string;
  summary: string;
  sources: string[];
  trace: TraceStep[];
};

async function fetchOne(postcode: string): Promise<SynthesiseResponse> {
  const res = await fetch(`/api/synthesise?postcode=${encodeURIComponent(postcode)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default function Home() {
  const [postcodeA, setPostcodeA] = useState("NW3");
  const [postcodeB, setPostcodeB] = useState("SE10");
  const [loading, setLoading] = useState(false);
  const [resultA, setResultA] = useState<SynthesiseResponse | null>(null);
  const [resultB, setResultB] = useState<SynthesiseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compare(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultA(null);
    setResultB(null);
    try {
      const [a, b] = await Promise.all([fetchOne(postcodeA), fetchOne(postcodeB)]);
      setResultA(a);
      setResultB(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <main className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">SkyMate</h1>
            <span className="text-sm text-zinc-500 font-mono">agentic housing intelligence</span>
          </div>
          <p className="text-zinc-400 text-sm max-w-2xl">
            Compare two UK postcodes on live air quality, noise, and similarity to areas you already know.
            Each answer ships with the agent&apos;s decision trace — see exactly which sources it pulled and how it weighted them.
          </p>
        </header>

        <form
          onSubmit={compare}
          className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
        >
          <PostcodeInput label="Postcode A" value={postcodeA} onChange={setPostcodeA} />
          <PostcodeInput label="Postcode B" value={postcodeB} onChange={setPostcodeB} />
          <button
            type="submit"
            disabled={loading || !postcodeA || !postcodeB}
            className="h-11 px-6 rounded-md bg-emerald-500 text-zinc-950 font-medium hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Asking the agent…" : "Compare"}
          </button>
        </form>

        {error && (
          <div className="border border-red-900 bg-red-950/40 text-red-200 px-4 py-3 rounded-md font-mono text-sm">
            {error}
          </div>
        )}

        <LondonMap postcodes={[postcodeA, postcodeB].filter(Boolean)} />

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResultCard result={resultA} loading={loading} placeholder="Postcode A" />
          <ResultCard result={resultB} loading={loading} placeholder="Postcode B" />
        </section>

        {(resultA || resultB) && (
          <TracePanel left={resultA} right={resultB} />
        )}

        <footer className="text-xs text-zinc-600 font-mono pt-8 border-t border-zinc-900">
          MongoDB Atlas · Vector Search · Time-series · Bedrock Haiku 4.5 · DEFRA UK-AIR
        </footer>
      </main>
    </div>
  );
}

function PostcodeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 flex-1">
      <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="e.g. NW3"
        className="h-11 px-3 rounded-md bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:outline-none font-mono text-sm"
      />
    </label>
  );
}

function ResultCard({ result, loading, placeholder }: { result: SynthesiseResponse | null; loading: boolean; placeholder: string }) {
  if (!result && loading) {
    return (
      <div className="border border-zinc-800 rounded-lg p-5 min-h-[200px] flex items-center justify-center">
        <div className="text-zinc-500 text-sm font-mono animate-pulse">retrieving…</div>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="border border-zinc-900 border-dashed rounded-lg p-5 min-h-[200px] flex items-center justify-center">
        <div className="text-zinc-700 text-sm">{placeholder} — no result yet</div>
      </div>
    );
  }
  return (
    <article className="border border-zinc-800 rounded-lg p-5 flex flex-col gap-3 bg-zinc-900/30">
      <header className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold font-mono">{result.postcode}</h2>
      </header>
      <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
        {result.summary}
      </div>
      {result.sources?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
          {result.sources.map((s, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 font-mono">
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
    <section className="border border-zinc-800 rounded-lg overflow-hidden">
      <header className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 border-b border-zinc-800">
        <h3 className="text-sm font-semibold tracking-wide">Decision trace</h3>
        <span className="text-xs text-zinc-500 font-mono">how the agent reached each answer</span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-zinc-800">
        <TraceColumn label={left?.postcode ?? "A"} steps={left?.trace ?? []} />
        <TraceColumn label={right?.postcode ?? "B"} steps={right?.trace ?? []} />
      </div>
    </section>
  );
}

function TraceColumn({ label, steps }: { label: string; steps: TraceStep[] }) {
  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-zinc-500 font-mono">{label}</div>
      {steps.length === 0 && <div className="text-xs text-zinc-700">no trace</div>}
      {steps.map((s, i) => (
        <div key={i} className="flex flex-col gap-0.5 py-2 border-b border-zinc-900 last:border-b-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-mono text-emerald-400">{s.step}</span>
            <span className="text-[10px] text-zinc-600 font-mono">
              w={s.weight.toFixed(2)} · {s.tookMs}ms
            </span>
          </div>
          <div className="text-xs text-zinc-500 font-mono">{s.source}</div>
          <div className="text-xs text-zinc-400">{s.summary}</div>
        </div>
      ))}
    </div>
  );
}
