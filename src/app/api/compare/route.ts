import { NextResponse } from "next/server";
import { callHaiku } from "@/lib/bedrock";
import type { DefraReading } from "@/lib/defra";
import type { FlightIntensity } from "@/lib/flight-paths";

type ComparePayload = {
  postcodeA: string;
  postcodeB: string;
  summaryA: string;
  summaryB: string;
  defraA: DefraReading[];
  defraB: DefraReading[];
  flightA?: FlightIntensity;
  flightB?: FlightIntensity;
  preference?: string;
};

const SYSTEM_PROMPT =
  "You are a calm UK housing advisor delivering a one-sentence verdict between two postcodes. Be concrete and specific - name the postcodes, name one or two metrics, declare a winner per metric. No hedging, no headers, no markdown. Maximum 35 words.";

function topPollutant(readings: DefraReading[]): string {
  if (!readings.length) return "n/a";
  const r = readings[0];
  return `NO2 ${r.pollutants.no2} µg/m³ at ${r.stationName}`;
}

export async function POST(request: Request) {
  let payload: ComparePayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { postcodeA, postcodeB, summaryA, summaryB, defraA, defraB, flightA, flightB, preference } = payload;

  if (!postcodeA || !postcodeB || !summaryA || !summaryB) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const userPrompt = [
    `Postcode A: ${postcodeA}`,
    `- summary: ${summaryA}`,
    `- closest air reading: ${topPollutant(defraA ?? [])}`,
    flightA ? `- flight intensity: ${flightA.intensity.toFixed(2)} (${flightA.primaryCorridor})` : "",
    "",
    `Postcode B: ${postcodeB}`,
    `- summary: ${summaryB}`,
    `- closest air reading: ${topPollutant(defraB ?? [])}`,
    flightB ? `- flight intensity: ${flightB.intensity.toFixed(2)} (${flightB.primaryCorridor})` : "",
    "",
    preference && preference !== "default"
      ? `User profile: ${preference}. Weight your verdict to what matters under that profile.`
      : "User profile: balanced.",
    "",
    "Write the one-sentence verdict.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await callHaiku(SYSTEM_PROMPT, userPrompt);
    return NextResponse.json({ verdict: result.text, modelId: result.modelId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "synthesis failed" },
      { status: 500 },
    );
  }
}
