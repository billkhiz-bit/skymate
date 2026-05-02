import { NextResponse } from "next/server";
import { getOrCreateSessionId, applySessionCookie } from "@/lib/sessions";
import { getRecentQueries } from "@/lib/query-log";

export async function GET() {
  const { sid, isNew } = await getOrCreateSessionId();
  const recent = isNew ? [] : await getRecentQueries(sid, 6);

  const response = NextResponse.json({
    sessionId: sid,
    recent: recent.map((r) => ({
      postcode: r.postcode,
      preference: r.preference,
      summaryPreview: r.summaryPreview,
      ts: r.ts instanceof Date ? r.ts.toISOString() : r.ts,
    })),
  });

  if (isNew) applySessionCookie(response, sid);
  return response;
}
