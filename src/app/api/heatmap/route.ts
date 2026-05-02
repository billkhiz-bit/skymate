import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

type HeatmapRow = {
  postcode: string;
  avgNo2: number;
  avgPm25: number;
  avgPm10: number;
  count: number;
  latestTs: string;
};

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db
      .collection("air_quality")
      .aggregate<{
        _id: string;
        avgNo2: number;
        avgPm25: number;
        avgPm10: number;
        count: number;
        latestTs: Date;
      }>([
        // Last 7 days only - cheap guard on a growing time-series collection.
        { $match: { ts: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: "$postcode",
            avgNo2: { $avg: "$no2" },
            avgPm25: { $avg: "$pm25" },
            avgPm10: { $avg: "$pm10" },
            count: { $sum: 1 },
            latestTs: { $max: "$ts" },
          },
        },
        { $sort: { avgNo2: -1 } },
        { $limit: 50 },
      ])
      .toArray();

    const rows: HeatmapRow[] = docs.map((d) => ({
      postcode: d._id,
      avgNo2: Math.round(d.avgNo2 * 10) / 10,
      avgPm25: Math.round(d.avgPm25 * 10) / 10,
      avgPm10: Math.round(d.avgPm10 * 10) / 10,
      count: d.count,
      latestTs: d.latestTs.toISOString(),
    }));

    return NextResponse.json({ rows, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.warn("[/api/heatmap] failed:", err);
    return NextResponse.json({ rows: [], error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
