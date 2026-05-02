import { NextResponse } from "next/server";
import { callHaiku } from "@/lib/bedrock";

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

const SYSTEM_PROMPT = "You are a calm UK housing advisor. Two sentences max.";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = (searchParams.get("postcode") ?? "NW3").toUpperCase();

  const userPrompt = `Write a noise and air-quality summary for postcode ${postcode}.`;

  const synthStart = Date.now();
  const result = await callHaiku(SYSTEM_PROMPT, userPrompt);
  const synthTookMs = Date.now() - synthStart;

  const preview = result.text.length > 120 ? `${result.text.slice(0, 117)}...` : result.text;

  const body: SynthesiseResponse = {
    postcode,
    summary: result.text,
    sources: ["DEFRA (stub)", "VectorSearch (stub)", `Bedrock ${result.modelId}`],
    trace: [
      { step: "decompose", source: "router", weight: 1.0, tookMs: 1, summary: "Hardcoded plan: pull DEFRA + similar postcodes" },
      { step: "fetch_air_quality", source: "DEFRA", weight: 0.6, tookMs: 1, summary: "Stub: no real call yet" },
      { step: "fetch_similar_postcodes", source: "Atlas Vector Search", weight: 0.4, tookMs: 1, summary: "Stub: no embeddings yet" },
      { step: "synthesise", source: "Bedrock Haiku 4.5", weight: 1.0, tookMs: synthTookMs, summary: preview },
    ],
  };

  return NextResponse.json(body);
}
