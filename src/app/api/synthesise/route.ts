import { NextResponse } from "next/server";
import { callHaiku, callTitanEmbed } from "@/lib/bedrock";
import { fetchAirQualityNearPostcode, type DefraReading } from "@/lib/defra";
import { findSimilarPostcodes, type SimilarPostcode } from "@/lib/vector-search";

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

function timed<T>(p: Promise<T>): Promise<{ value: T; tookMs: number }> {
  const start = Date.now();
  return p.then((value) => ({ value, tookMs: Date.now() - start }));
}

function formatDefraContext(readings: DefraReading[]): string {
  return readings
    .map(
      (r) =>
        `- ${r.stationName} (${r.distanceKm} km): NO2 ${r.pollutants.no2} µg/m³, PM2.5 ${r.pollutants.pm25} µg/m³, PM10 ${r.pollutants.pm10} µg/m³`,
    )
    .join("\n");
}

function formatSimilarContext(similar: SimilarPostcode[]): string {
  return similar
    .map((s) => `- ${s.postcode} (${s.name}, score ${s.score.toFixed(3)}): ${s.description}`)
    .join("\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = (searchParams.get("postcode") ?? "NW3").toUpperCase();

  const defraPromise = timed(fetchAirQualityNearPostcode(postcode));
  const similarPromise = timed(
    callTitanEmbed(`Air quality and neighbourhood vibe for postcode ${postcode}`).then((e) =>
      findSimilarPostcodes(e.embedding, postcode, 3),
    ),
  );

  const [defra, similar] = await Promise.all([defraPromise, similarPromise]);

  const userPrompt = [
    `Write a noise and air-quality summary for postcode ${postcode}.`,
    "",
    "Latest DEFRA readings (nearest stations):",
    formatDefraContext(defra.value),
    "",
    "Comparable London postcodes (vector search):",
    formatSimilarContext(similar.value),
    "",
    "Reference at least one DEFRA pollutant figure in your reply.",
  ].join("\n");

  const synthStart = Date.now();
  const result = await callHaiku(SYSTEM_PROMPT, userPrompt);
  const synthTookMs = Date.now() - synthStart;

  const preview = result.text.length > 120 ? `${result.text.slice(0, 117)}...` : result.text;

  const stationNames = defra.value.map((r) => r.stationName);
  const similarPostcodes = similar.value.map((s) => s.postcode);

  const body: SynthesiseResponse = {
    postcode,
    summary: result.text,
    sources: [
      ...stationNames.map((n) => `DEFRA: ${n}`),
      "MongoDB Atlas Vector Search (postcode_idx)",
      `Bedrock ${result.modelId}`,
    ],
    trace: [
      { step: "decompose", source: "router", weight: 1.0, tookMs: 1, summary: "Plan: DEFRA air quality + Atlas Vector Search on postcode embedding" },
      {
        step: "fetch_air_quality",
        source: "DEFRA",
        weight: 0.6,
        tookMs: defra.tookMs,
        summary: `Pulled ${defra.value.length} stations near ${postcode} (closest: ${stationNames[0]} @ ${defra.value[0].distanceKm} km)`,
      },
      {
        step: "fetch_similar_postcodes",
        source: "Atlas Vector Search",
        weight: 0.4,
        tookMs: similar.tookMs,
        summary: `Top ${similar.value.length} similar postcodes via Titan v2 + $vectorSearch: ${similarPostcodes.join(", ")}`,
      },
      { step: "synthesise", source: "Bedrock Haiku 4.5", weight: 1.0, tookMs: synthTookMs, summary: preview },
    ],
  };

  return NextResponse.json(body);
}
