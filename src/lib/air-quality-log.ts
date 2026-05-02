import { getDb } from "@/lib/mongodb";
import type { DefraReading } from "@/lib/defra";

const COLLECTION = "air_quality";

type AirQualityDoc = {
  ts: Date;
  postcode: string;
  station: string;
  distanceKm: number;
  no2: number;
  pm25: number;
  pm10: number;
};

export async function appendAirQualitySnapshot(
  postcode: string,
  readings: DefraReading[],
): Promise<void> {
  if (!readings.length) return;
  try {
    const db = await getDb();
    const ts = new Date();
    const docs: AirQualityDoc[] = readings.map((r) => ({
      ts,
      postcode,
      station: r.stationName,
      distanceKm: r.distanceKm,
      no2: r.pollutants.no2,
      pm25: r.pollutants.pm25,
      pm10: r.pollutants.pm10,
    }));
    await db.collection<AirQualityDoc>(COLLECTION).insertMany(docs, { ordered: false });
  } catch (err) {
    console.warn("[air-quality-log] insertMany failed:", err);
  }
}
