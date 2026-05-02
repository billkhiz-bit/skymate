import { NextResponse } from "next/server";

export type TraceStep = {
  step: string;
  source: string;
  weight: number;
  tookMs: number;
  summary: string;
};

export type SynthesiseResponse = {
  postcode: string;
  summary: string;
  sources: string[];
  trace: TraceStep[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = (searchParams.get("postcode") ?? "NW3").toUpperCase();

  const body: SynthesiseResponse = {
    postcode,
    summary: `STUB: synthesised summary for ${postcode}. Replace with real Bedrock call.`,
    sources: ["DEFRA (stub)", "VectorSearch (stub)"],
    trace: [
      { step: "decompose", source: "router", weight: 1.0, tookMs: 1, summary: "Hardcoded plan: pull DEFRA + similar postcodes" },
      { step: "fetch_air_quality", source: "DEFRA", weight: 0.6, tookMs: 1, summary: "Stub: no real call yet" },
      { step: "fetch_similar_postcodes", source: "Atlas Vector Search", weight: 0.4, tookMs: 1, summary: "Stub: no embeddings yet" },
      { step: "synthesise", source: "Bedrock Haiku 4.5", weight: 1.0, tookMs: 1, summary: "Stub: no LLM call yet" },
    ],
  };

  return NextResponse.json(body);
}
