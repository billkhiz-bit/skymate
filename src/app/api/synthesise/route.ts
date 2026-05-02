import { NextResponse } from "next/server";
import { callHaiku, callTitanEmbed } from "@/lib/bedrock";
import { fetchAirQualityNearPostcode, type DefraReading } from "@/lib/defra";
import { findSimilarPostcodes, type SimilarPostcode } from "@/lib/vector-search";
import { getFlightIntensity, type FlightIntensity } from "@/lib/flight-paths";
import { getOrCreateSessionId, applySessionCookie } from "@/lib/sessions";
import { appendQuery } from "@/lib/query-log";
import { appendAirQualitySnapshot } from "@/lib/air-quality-log";

export type TraceStep = {
  step: string;
  source: string;
  weight: number;
  tookMs: number;
  summary: string;
};

export type SynthesiseResponse = {
  postcode: string;
  preference: Preference;
  summary: string;
  sources: string[];
  trace: TraceStep[];
  sessionId: string;
  defra: DefraReading[];
  flight: FlightIntensity;
};

const PREFERENCES = ["default", "family", "air", "quiet", "flights"] as const;
type Preference = (typeof PREFERENCES)[number];

const PROMPT_TIGHTENER = " Maximum 60 words. Plain prose only — no headers, no bullet lists, no markdown.";

type ProfileConfig = {
  defraWeight: number;
  vectorWeight: number;
  flightWeight: number;
  decomposePlan: string;
  systemPrompt: string;
  userPromptHint: string;
};

const PROFILES: Record<Preference, ProfileConfig> = {
  default: {
    defraWeight: 0.6,
    vectorWeight: 0.4,
    flightWeight: 0.3,
    decomposePlan: "Plan: DEFRA + Atlas Vector Search + flight intensity (balanced)",
    systemPrompt: "You are a calm UK housing advisor. Two sentences max." + PROMPT_TIGHTENER,
    userPromptHint: "Reference at least one DEFRA pollutant figure in your reply.",
  },
  family: {
    defraWeight: 0.75,
    vectorWeight: 0.5,
    flightWeight: 0.5,
    decomposePlan: "Plan: DEFRA (heavy) + Vector Search + flight intensity — family profile, kids-first framing",
    systemPrompt:
      "You are a calm UK housing advisor speaking to a family with young children. Two sentences max. Lead with what the air quality and noise mean for kids; mention parks or quiet streets where relevant." +
      PROMPT_TIGHTENER,
    userPromptHint: "The reader has young children. Reference at least one DEFRA pollutant figure and call out anything noise-related.",
  },
  air: {
    defraWeight: 0.95,
    vectorWeight: 0.2,
    flightWeight: 0.1,
    decomposePlan: "Plan: DEFRA dominates (0.95) — air-quality-first, similarity + flight de-prioritised",
    systemPrompt:
      "You are an air quality specialist for someone with respiratory sensitivity. Two sentences max. Lead with the most important DEFRA pollutant figure and what it means for them." +
      PROMPT_TIGHTENER,
    userPromptHint: "Lead with the highest DEFRA pollutant reading and explain its health implication. Be specific about µg/m³.",
  },
  quiet: {
    defraWeight: 0.35,
    vectorWeight: 0.75,
    flightWeight: 0.6,
    decomposePlan: "Plan: Vector Search (0.75) + flight intensity (0.6) — quiet profile, lean on peaceful neighbours",
    systemPrompt:
      "You are a calm UK housing advisor for someone who values peace and quiet. Two sentences max. Focus on noise sources (traffic, transport, nightlife, flight paths) and how this postcode compares to quieter alternatives." +
      PROMPT_TIGHTENER,
    userPromptHint: "Emphasise noise and tranquillity. Reference at least one DEFRA figure but lead with the noise dimension.",
  },
  flights: {
    defraWeight: 0.4,
    vectorWeight: 0.3,
    flightWeight: 0.95,
    decomposePlan: "Plan: Flight intensity dominates (0.95) — avoiding overhead aircraft is the user's top priority",
    systemPrompt:
      "You are a calm UK housing advisor for someone sensitive to aircraft noise. Two sentences max. Lead with overflight intensity and the primary flight corridor; reference DEFRA briefly only for context." +
      PROMPT_TIGHTENER,
    userPromptHint:
      "Lead with the flight overflight intensity (0–1) and the primary corridor (Heathrow, City Airport, or Stansted). DEFRA second.",
  },
};

function parsePreference(raw: string | null): Preference {
  if (raw && (PREFERENCES as readonly string[]).includes(raw)) return raw as Preference;
  return "default";
}

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

function formatFlightContext(f: FlightIntensity): string {
  return `- intensity ${f.intensity.toFixed(2)} (0=clear, 1=under approach), corridor: ${f.primaryCorridor}, altitude band: ${f.altitudeBand}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = (searchParams.get("postcode") ?? "NW3").toUpperCase();
  const preference = parsePreference(searchParams.get("preference"));
  const profile = PROFILES[preference];

  const { sid, isNew } = await getOrCreateSessionId();

  const defraPromise = timed(fetchAirQualityNearPostcode(postcode));
  const similarPromise = timed(
    callTitanEmbed(`Air quality and neighbourhood vibe for postcode ${postcode}`).then((e) =>
      findSimilarPostcodes(e.embedding, postcode, 3),
    ),
  );
  const flightPromise = timed(getFlightIntensity(postcode));

  const [defra, similar, flight] = await Promise.all([defraPromise, similarPromise, flightPromise]);

  // Persist DEFRA snapshot to the time-series collection. Fire and await briefly
  // so it actually flushes — typical insertMany of 6 docs is 30-60 ms.
  await appendAirQualitySnapshot(postcode, defra.value);

  const userPrompt = [
    `Write a noise and air-quality summary for postcode ${postcode}.`,
    "",
    "Latest DEFRA readings (nearest stations):",
    formatDefraContext(defra.value),
    "",
    "Comparable London postcodes (vector search):",
    formatSimilarContext(similar.value),
    "",
    "Flight overflight profile:",
    formatFlightContext(flight.value),
    "",
    profile.userPromptHint,
  ].join("\n");

  const synthStart = Date.now();
  const result = await callHaiku(profile.systemPrompt, userPrompt);
  const synthTookMs = Date.now() - synthStart;

  const preview = result.text.length > 120 ? `${result.text.slice(0, 117)}...` : result.text;
  const summaryPreview = result.text.length > 80 ? `${result.text.slice(0, 77)}...` : result.text;

  await appendQuery({
    sessionId: sid,
    postcode,
    preference,
    summaryPreview,
    ts: new Date(),
  });

  const stationNames = defra.value.map((r) => r.stationName);
  const similarPostcodes = similar.value.map((s) => s.postcode);

  const body: SynthesiseResponse = {
    postcode,
    preference,
    summary: result.text,
    sources: [
      ...stationNames.map((n) => `DEFRA: ${n}`),
      "MongoDB Atlas Vector Search (postcode_idx)",
      `Flight intensity: ${flight.value.primaryCorridor}`,
      `Bedrock ${result.modelId}`,
    ],
    trace: [
      { step: "decompose", source: `router (profile: ${preference})`, weight: 1.0, tookMs: 1, summary: profile.decomposePlan },
      {
        step: "fetch_air_quality",
        source: "DEFRA → Atlas time-series",
        weight: profile.defraWeight,
        tookMs: defra.tookMs,
        summary: `Pulled ${defra.value.length} stations near ${postcode} (closest: ${stationNames[0]} @ ${defra.value[0].distanceKm} km) · written to air_quality time-series`,
      },
      {
        step: "fetch_similar_postcodes",
        source: "Atlas Vector Search",
        weight: profile.vectorWeight,
        tookMs: similar.tookMs,
        summary: `Top ${similar.value.length} similar postcodes via Titan v2 + $vectorSearch: ${similarPostcodes.join(", ")}`,
      },
      {
        step: "fetch_flight_intensity",
        source: "Flight corridors (CAA / HACAN)",
        weight: profile.flightWeight,
        tookMs: flight.tookMs,
        summary: `${postcode}: intensity ${flight.value.intensity.toFixed(2)} · ${flight.value.primaryCorridor} (${flight.value.altitudeBand})`,
      },
      { step: "synthesise", source: "Bedrock Haiku 4.5", weight: 1.0, tookMs: synthTookMs, summary: preview },
    ],
    sessionId: sid,
    defra: defra.value,
    flight: flight.value,
  };

  const response = NextResponse.json(body);
  if (isNew) applySessionCookie(response, sid);
  return response;
}
